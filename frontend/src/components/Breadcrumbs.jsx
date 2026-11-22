import Icon from "./Icon";

export default function Breadcrumbs({ items }) {
  return (
    <nav className="flex items-center gap-2 flex-wrap" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          {item.href ? (
            <>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-purple-900/20 hover:text-purple-300 transition-all"
                onClick={item.onClick}
              >
                {item.icon && <Icon name={item.icon} size={14} />}
                <span className="truncate max-w-[150px]">{item.label}</span>
              </button>
              {index < items.length - 1 && (
                <Icon name="chevronRight" size={14} className="text-slate-700 flex-shrink-0" />
              )}
            </>
          ) : (
            <>
              <span className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-purple-400">
                {item.icon && <Icon name={item.icon} size={14} />}
                <span className="truncate max-w-[200px]">{item.label}</span>
              </span>
              {index < items.length - 1 && (
                <Icon name="chevronRight" size={14} className="text-slate-700 flex-shrink-0" />
              )}
            </>
          )}
        </span>
      ))}
    </nav>
  );
}
