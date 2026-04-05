import ChatConversationScreen from "@/components/ChatCoversationScree";

interface ChatPageProps {
  params: Promise<{ chatId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatId } = await params;
  return <ChatConversationScreen chatId={chatId} />;
}






