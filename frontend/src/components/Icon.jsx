import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  CircleHelp,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  CloudUpload,
  Copy,
  FilePlus2,
  FileText,
  History,
  Image,
  Info,
  Layers3,
  LayoutGrid,
  LockKeyhole,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from "lucide-react";

const ICONS = {
  shield: ShieldCheck,
  grid: LayoutGrid,
  filePlus: FilePlus2,
  file: FileText,
  history: History,
  chart: ChartNoAxesColumnIncreasing,
  help: CircleHelp,
  lock: LockKeyhole,
  upload: Upload,
  cloud: CloudUpload,
  trash: Trash2,
  arrow: ArrowRight,
  arrowLeft: ArrowLeft,
  check: Check,
  close: X,
  calendar: CalendarDays,
  alert: TriangleAlert,
  xCircle: CircleX,
  checkCircle: CircleCheck,
  info: Info,
  clock: Clock,
  menu: Menu,
  refresh: RefreshCw,
  chevron: ChevronDown,
  image: Image,
  clipboard: ClipboardCheck,
  copy: Copy,
  sliders: SlidersHorizontal,
  layers: Layers3,
  user: UserRound,
  search: Search,
};

export default function Icon({ name, size = 20, className }) {
  const IconComponent = ICONS[name] || FileText;
  return (
    <IconComponent
      className={className}
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
    />
  );
}
