import FaceCircleCapture5 from "./FaceCircleCapture5";

type Props = { onComplete: (images: string[]) => void; onCancel: () => void };

export default function FaceCapture5(props: Props) {
  return <FaceCircleCapture5 {...props} />;
}
