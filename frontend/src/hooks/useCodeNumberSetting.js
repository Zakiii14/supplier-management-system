import { useEffect, useState } from "react";
import { getCodeNumberSettingRequest } from "../api/codeNumberSettings";

const useCodeNumberSetting = (
  moduleKey,
  isEnabled = true,
) => {
  const [setting, setSetting] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }

    let isCancelled = false;

    const loadSetting = async () => {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const result =
          await getCodeNumberSettingRequest(moduleKey);

        if (!isCancelled) {
          setSetting(result);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error.response?.data?.message ||
              "Pengaturan kode gagal dimuat.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSetting();

    return () => {
      isCancelled = true;
    };
  }, [isEnabled, moduleKey]);

  return {
    setting,
    isLoading,
    errorMessage,
  };
};

export default useCodeNumberSetting;
