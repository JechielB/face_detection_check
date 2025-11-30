import { useNavigate } from "react-router-dom";
import FaceCapture5 from "../components/SignUp/Camera/FaceCapture5";

type CameraModalProps = {
  open: boolean;
  onClose: () => void;
  onDone: (images: string[]) => Promise<void>;
};

export default function CameraModal({
  open,
  onClose,
  onDone,
}: CameraModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-0"
      style={{ background: "rgba(0,0,0,0.65)" }}
    >
      <div className="w-full h-full max-w-[480px] rounded-none sm:rounded-[24px] bg-[rgba(5,5,5,0.95)] overflow-hidden border border-white/5 flex">
        <FaceCapture5
          onComplete={async (images) => {
            await onDone(images);
            navigate("/queue", { replace: true });
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
