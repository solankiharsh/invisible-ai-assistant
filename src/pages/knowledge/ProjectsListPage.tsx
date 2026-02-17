import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/layouts";
import { Button } from "@/components";
import { getAllProjects } from "@/lib/database/knowledge.action";
import type { Project } from "@/types";
import { FolderIcon, PlusIcon } from "lucide-react";

const ProjectsListPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageLayout
      title="Projects"
      description="Organize knowledge items into projects."
      rightSlot={
        <Button size="sm" disabled>
          <PlusIcon className="h-4 w-4 mr-2" />
          New project (coming soon)
        </Button>
      }
    >
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Create one to group related items.
          </p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/knowledge/projects/${project.id}`)}
              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50"
            >
              <FolderIcon className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{project.name}</p>
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {project.description}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </PageLayout>
  );
};

export default ProjectsListPage;
