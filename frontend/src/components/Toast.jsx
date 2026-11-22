import { Toaster } from "react-hot-toast";

export default function ToastContainer() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: "#14171a",
          color: "#f3f4f6",
          border: "1px solid #2a2f35",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "13px",
          fontWeight: "500",
        },
        success: {
          iconTheme: {
            primary: "#22c55e",
            secondary: "#14171a",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#14171a",
          },
        },
      }}
    />
  );
}
