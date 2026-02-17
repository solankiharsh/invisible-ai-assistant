import { useSearchParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { KnowledgeChat } from "./components";

const KnowledgeChatPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const itemId = searchParams.get("itemId") ?? undefined;

  return (
    <PageLayout
      title={itemId ? "Chat about this item" : "Chat with everything"}
      description={
        itemId
          ? "Answers are grounded in the selected item."
          : "Ask anything; answers are grounded in your full knowledge base."
      }
    >
      <KnowledgeChat
        itemIdFilter={itemId}
        onBack={() => navigate("/knowledge")}
      />
    </PageLayout>
  );
};

export default KnowledgeChatPage;
