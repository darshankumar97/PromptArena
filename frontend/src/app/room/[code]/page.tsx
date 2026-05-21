import { RoomView } from "@/components/room/RoomView";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomView roomCode={code.toUpperCase()} />;
}
