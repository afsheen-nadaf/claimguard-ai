import Icon from "./Icon";

export default function Timeline({ events }) {
  return (
    <div className="space-y-6">
      {events.map((event, index) => (
        <div key={index} className="flex items-start gap-4">
          {/* Timeline Icon */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg flex-shrink-0 ${
            event.type === "success"
              ? "bg-emerald-950 border-emerald-500 shadow-emerald-500/30"
              : event.type === "warning"
              ? "bg-amber-950 border-amber-500 shadow-amber-500/30"
              : "bg-purple-950 border-purple-500 shadow-purple-500/30"
          }`}>
            <Icon
              name={event.icon}
              size={16}
              className={
                event.type === "success"
                  ? "text-emerald-400"
                  : event.type === "warning"
                  ? "text-amber-400"
                  : "text-purple-400"
              }
            />
          </div>

          {/* Event Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <span className="text-sm font-semibold text-[#f5f0e8]">{event.title}</span>
              <span className="text-xs text-purple-400 whitespace-nowrap">{event.time}</span>
            </div>
            {event.description && (
              <div className="mt-2 text-sm text-purple-300 leading-relaxed">{event.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
