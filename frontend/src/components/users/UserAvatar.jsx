import { useEffect, useState } from "react";
import { getUserAvatarRequest } from "../../api/users";

const getInitials = (name = "User") =>
  name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

const UserAvatar = ({ user, className = "", alt = "" }) => {
  const [source, setSource] = useState("");
  const displayName = user?.full_name || user?.username || "User";

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    if (!user?.id || !user?.has_avatar) {
      return undefined;
    }
    getUserAvatarRequest(user.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => setSource(""));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id, user?.has_avatar, user?.avatar_updated_at]);

  return (
    <span className={`user-avatar ${className}`.trim()} aria-label={alt || `Foto ${displayName}`}>
      {user?.has_avatar && source ? <img src={source} alt="" /> : getInitials(displayName)}
    </span>
  );
};

export default UserAvatar;
