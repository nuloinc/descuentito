import { Link } from "@tanstack/react-router";

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="space-y-2 p-2">
      <div className="text-gray-600 dark:text-gray-400">
        {children || <p>La página que estás buscando no existe.</p>}
      </div>
      <p className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.history.back()}
          className="bg-emerald-500 text-white px-2 py-1 rounded uppercase font-black text-sm"
        >
          Volver
        </button>
        <Link
          to="/"
          search={{ supermarket: undefined }}
          className="bg-cyan-600 text-white px-2 py-1 rounded uppercase font-black text-sm"
        >
          Volver a la página de inicio
        </Link>
      </p>
    </div>
  );
}
