import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { Button } from "@/components";
import { PageEditor } from "./components";
import { ArrowLeftIcon } from "lucide-react";

const PageEditorPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pageId = id === "new" ? "new" : id ?? null;

  return (
    <PageLayout
      title={pageId === "new" ? "New page" : "Edit page"}
      description={pageId === "new" ? "Create a new document." : "Edit your document."}
      rightSlot={
        <Button variant="ghost" size="sm" onClick={() => navigate("/knowledge/pages")}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to pages
        </Button>
      }
    >
      <PageEditor
        pageId={pageId}
        onSave={() => navigate("/knowledge/pages")}
      />
    </PageLayout>
  );
};

export default PageEditorPage;
