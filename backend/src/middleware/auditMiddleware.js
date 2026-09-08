const pool = require("../config/database");

const TABLES = {
  users: "app.users", suppliers: "app.suppliers", categories: "app.categories",
  products: "app.products", "purchase-orders": "app.purchase_orders",
  "goods-receipts": "app.goods_receipts", customers: "app.customers",
  "sales-orders": "app.sales_orders", deliveries: "app.deliveries",
  invoices: "app.invoices", payments: "app.payments",
  "supplier-invoices": "app.supplier_invoices",
};
const LABEL_FIELDS = ["invoice_number","payment_number","po_number","so_number","receipt_number","delivery_number","sku","supplier_code","category_code","customer_code","username","full_name","product_name","supplier_name","customer_name"];
const SENSITIVE = /password|token|secret|authorization|checksum|storage_name/i;
const METHODS = new Set(["POST","PUT","PATCH","DELETE"]);
const UUID = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

const sanitize = (value, depth=0) => {
  if (depth>5 || value===undefined) return undefined;
  if (value===null || typeof value!=="object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return "[binary]";
  if (Array.isArray(value)) return value.slice(0,100).map((item)=>sanitize(item,depth+1));
  return Object.fromEntries(Object.entries(value).filter(([key])=>!SENSITIVE.test(key)).map(([key,item])=>[key,sanitize(item,depth+1)]));
};
const moduleName = (path) => path.split("/").filter(Boolean)[0] || "system";
const actionName = (method,path) => {
  if(method==="POST") return /status|confirm|submit|reset|approval|decision|reject/i.test(path)?"PROCESS":"CREATE";
  if(method==="DELETE") return "DELETE";
  return /status|confirm|submit|reset|approval|decision|reject/i.test(path)?"PROCESS":"UPDATE";
};
const findLabel = (...objects) => {
  for(const object of objects) for(const field of LABEL_FIELDS) if(object?.[field]) return String(object[field]).slice(0,180);
  return null;
};

const auditMiddleware = async (req,res,next) => {
  if(!METHODS.has(req.method) || req.path.startsWith("/auth") || req.path.startsWith("/audit-logs") || req.path.startsWith("/notifications")) return next();
  const module=moduleName(req.path), id=req.path.match(UUID)?.[1]||null;
  let previous=null;
  if(id && TABLES[module]) {
    try { previous=(await pool.query(`SELECT * FROM ${TABLES[module]} WHERE id=$1`,[id])).rows[0]||null; } catch { previous=null; }
  }
  let responseBody=null;
  const originalJson=res.json.bind(res);
  res.json=(body)=>{responseBody=body;return originalJson(body);};
  res.on("finish",()=>{
    if(!req.user || res.statusCode<200 || res.statusCode>=300) return;
    const result=responseBody?.data;
    const resultRecord=Array.isArray(result)?null:result;
    const rawEntityId=resultRecord?.id??id;
    const entityId=rawEntityId===null||rawEntityId===undefined?null:String(rawEntityId).slice(0,120);
    pool.query(`INSERT INTO app.audit_logs(user_id,username,user_role,action,module,entity_id,entity_label,request_method,request_path,previous_data,submitted_data,result_data,ip_address,user_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[
      req.user.id,req.user.username,req.user.role,actionName(req.method,req.path),module,entityId,
      findLabel(resultRecord,req.body,previous),req.method,req.originalUrl.slice(0,300),sanitize(previous),sanitize(req.body),sanitize(resultRecord),req.ip?.slice(0,80)||null,req.get("user-agent")?.slice(0,500)||null,
    ]).catch((error)=>console.error("Failed to write audit log:",error));
  });
  next();
};
module.exports=auditMiddleware;
