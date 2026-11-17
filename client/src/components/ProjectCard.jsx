import { ArrowRight, Calendar, Database, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from './Badge.jsx';
import Card from './Card.jsx';

export default function ProjectCard({ project, onDelete }) {
  const formattedDate = project.createdAt
    ? new Date(project.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card className="flex flex-col justify-between hover:border-brand/50 transition-colors group">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/projects/${project.id}/overview`}
            className="text-base font-semibold text-ink group-hover:text-brand-hover transition-colors line-clamp-1 focus:outline-none focus:underline"
          >
            {project.name}
          </Link>

          <button
            type="button"
            onClick={() => onDelete(project)}
            className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
            aria-label={`Delete project ${project.name}`}
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted line-clamp-2 min-h-[2rem]">
          {project.description || 'No description provided.'}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {project.demoKbLoaded ? (
            <Badge variant="success">
              <Database className="w-3 h-3 mr-0.5" aria-hidden="true" />
              Demo KB Loaded
            </Badge>
          ) : (
            <Badge variant="muted">
              <Database className="w-3 h-3 mr-0.5" aria-hidden="true" />
              Custom KB
            </Badge>
          )}

          {formattedDate && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted font-mono">
              <Calendar className="w-3 h-3" aria-hidden="true" />
              {formattedDate}
            </span>
          )}
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-line flex items-center justify-between">
        <span className="text-xs font-mono text-muted truncate">
          ID: {project.id.slice(0, 8)}...
        </span>
        <Link
          to={`/projects/${project.id}/overview`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover group-hover:translate-x-0.5 transition-transform"
        >
          Open Workspace
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
