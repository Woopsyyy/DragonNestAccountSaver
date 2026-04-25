const fs = require('fs');

const adminCode = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf-8');
const userCode = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

let newCode = userCode;

// 1. Add imports
const importsToAdd = `
import {
  FileText,
  GitBranch,
  Layers3,
  Trash2,
  UserCog,
} from 'lucide-react'
import { OverlaySurface } from './ui/OverlaySurface'
import {
  BarChart,
  ChartCard,
  DonutChart,
  TrendAreaChart,
} from './ui/InsightWidgets'
import {
  createClassNode,
  createPatchnote,
  deleteClassNode,
  deletePatchnote,
  listAllUsers,
  resetUserPassword,
  toggleUserAdmin,
} from '../lib/supabase'
`;
newCode = newCode.replace("import { CommandShell, type CommandNavItem } from './ui/CommandShell'", "import { CommandShell, type CommandNavItem } from './ui/CommandShell'\n" + importsToAdd);

// 2. Update Types
newCode = newCode.replace(
  "type Tab = 'overview' | 'classes' | 'calculator' | 'spam' | 'tickets' | 'patchnotes' | 'pet' | 'settings'",
  "type Tab = 'overview' | 'classes' | 'calculator' | 'spam' | 'tickets' | 'patchnotes' | 'pet' | 'settings' | 'admin-overview' | 'users' | 'admin-patchnotes' | 'admin-classes'\ntype AddMode = 'class' | 'type_class' | 'sub_class'"
);

// 3. Add helper functions
const adminHelpers = adminCode.substring(
  adminCode.indexOf('function monthlyTrend'),
  adminCode.indexOf('export default function AdminDashboard')
);
newCode = newCode.replace('// Chart data processors removed', adminHelpers);

// 4. Update Dashboard function
const dashboardStart = newCode.indexOf('export default function Dashboard');

// Inject states and memos
const statesToInject = `
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [resetting, setResetting] = useState<string | null>(null)
  const [passwordResult, setPasswordResult] = useState<{ username: string; password: string } | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [patchTitle, setPatchTitle] = useState('')
  const [patchContent, setPatchContent] = useState('')
  const [savingPatchnote, setSavingPatchnote] = useState(false)

  const userGrowthData = useMemo(() => monthlyTrend(users.map((entry) => entry.created_at)), [users])
  const patchnoteActivityData = useMemo(() => monthlyTrend(patchnotes.map((entry) => entry.created_at)), [patchnotes])
  const roleSplitData = useMemo(() => [
    { label: 'Admins', value: users.filter((entry) => entry.is_admin).length },
    { label: 'Users', value: users.filter((entry) => !entry.is_admin).length },
  ], [users])
  const classDepthData = useMemo(() => {
    const roots = classNodes.filter((node) => node.parent_id === null)
    const rootIds = new Set(roots.map((node) => node.id))
    const types = classNodes.filter((node) => node.parent_id && rootIds.has(node.parent_id))
    const typeIds = new Set(types.map((node) => node.id))
    const subclasses = classNodes.filter((node) => node.parent_id && typeIds.has(node.parent_id))
    return [
      { label: 'Roots', value: roots.length },
      { label: 'Types', value: types.length },
      { label: 'Subclasses', value: subclasses.length },
    ]
  }, [classNodes])

  const filteredUsers = useMemo(
    () => users.filter((entry) => \`\${entry.username ?? ''} \${entry.id}\`.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  )
`;
newCode = newCode.replace(
  '  const [expandedId, setExpandedId] = useState<string | null>(null)',
  '  const [expandedId, setExpandedId] = useState<string | null>(null)\n' + statesToInject
);

// Replace navItems entirely
const newNavItems = `
  const navItems: CommandNavItem<Tab>[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      key: 'account-group',
      label: 'Account',
      icon: Users,
      children: [
        { key: 'calculator', label: 'Calculator', icon: Calculator },
        { key: 'pet', label: 'Pet', icon: PawPrint },
        { key: 'spam', label: 'Spam Runs', icon: ShieldCheck },
        { key: 'classes', label: 'Accounts', icon: Database },
      ],
    },
    { key: 'patchnotes', label: 'Patchnotes', icon: BookOpen },
    { key: 'settings', label: 'Settings', icon: Settings },
  ]

  if (currentUser?.is_admin) {
    navItems.push({
      key: 'admin-group',
      label: 'Admin Panel',
      icon: Shield,
      children: [
        { key: 'admin-overview', label: 'Admin Overview', icon: LayoutDashboard },
        { key: 'users', label: 'Users', icon: Users },
        { key: 'admin-patchnotes', label: 'Manage Patchnotes', icon: FileText },
        { key: 'admin-classes', label: 'Class Tree', icon: GitBranch },
      ],
    })
  }
`;
newCode = newCode.replace(
  /const navItems: CommandNavItem<Tab>\[\] = \[[\s\S]*?\]/,
  newNavItems.trim()
);

// Inject logic into loadInitialState
newCode = newCode.replace(
  "listPatchnotes(),",
  "listPatchnotes(),\n          initialUser?.is_admin ? listAllUsers() : Promise.resolve([]),"
);
newCode = newCode.replace(
  "const [nextAccounts, nextClassNodes, nextPatchnotes] = await Promise.all([",
  "const [nextAccounts, nextClassNodes, nextPatchnotes, nextUsers] = await Promise.all(["
);
newCode = newCode.replace(
  "setPatchnotes(nextPatchnotes)",
  "setPatchnotes(nextPatchnotes)\n        setUsers(nextUsers)"
);

// Extract Handlers from AdminDashboard
const adminHandlersStart = adminCode.indexOf('  async function handleToggleRole');
const adminHandlersEnd = adminCode.indexOf('  if (loading) {');
const handlersToInject = adminCode.substring(adminHandlersStart, adminHandlersEnd);

newCode = newCode.replace(
  '  async function handleSignOut() {',
  handlersToInject + '\n  async function handleSignOut() {'
);

// Remove switchAction
newCode = newCode.replace(
  /switchAction=\{[\s\S]*?undefined\n\s*\}/,
  'switchAction={undefined}'
);

// Extract JSX
const adminJsxOverviewStart = adminCode.indexOf("{activeTab === 'overview' ? (");
const adminJsxOverviewEnd = adminCode.indexOf("{activeTab === 'users' ? (");
let overviewJsx = adminCode.substring(adminJsxOverviewStart, adminJsxOverviewEnd);
overviewJsx = overviewJsx.replace(/activeTab === 'overview'/g, "activeTab === 'admin-overview'");

const adminJsxUsersStart = adminCode.indexOf("{activeTab === 'users' ? (");
const adminJsxUsersEnd = adminCode.indexOf("{activeTab === 'patchnotes' ? (");
const usersJsx = adminCode.substring(adminJsxUsersStart, adminJsxUsersEnd);

const adminJsxPatchnotesStart = adminCode.indexOf("{activeTab === 'patchnotes' ? (");
const adminJsxPatchnotesEnd = adminCode.indexOf("{activeTab === 'classes' ? (");
let patchnotesJsx = adminCode.substring(adminJsxPatchnotesStart, adminJsxPatchnotesEnd);
patchnotesJsx = patchnotesJsx.replace(/activeTab === 'patchnotes'/g, "activeTab === 'admin-patchnotes'");

const adminJsxClassesStart = adminCode.indexOf("{activeTab === 'classes' ? (");
const adminJsxClassesEnd = adminCode.lastIndexOf("</CommandShell>");
let classesJsx = adminCode.substring(adminJsxClassesStart, adminJsxClassesEnd);
classesJsx = classesJsx.replace(/activeTab === 'classes'/g, "activeTab === 'admin-classes'");

const allAdminJsx = overviewJsx + usersJsx + patchnotesJsx + classesJsx;

newCode = newCode.replace(
  "        {activeTab === 'settings' ? (",
  allAdminJsx + "        {activeTab === 'settings' ? ("
);

fs.writeFileSync('src/components/Dashboard.tsx', newCode);
console.log('Merge complete!');
