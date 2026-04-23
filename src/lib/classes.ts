export type ClassNode = {
  label: string
  children?: ClassNode[]
}

export type FlatClassNode = {
  id: string
  label: string
  parent_id: string | null
  sort_order: number
}

export const CLASS_TREE: ClassNode[] = [
  {
    label: 'Warrior',
    children: [
      {
        label: 'Sword Master',
        children: [{ label: 'Gladiator' }, { label: 'Moonlord' }],
      },
      {
        label: 'Mercenary',
        children: [{ label: 'Barbarian' }, { label: 'Destroyer' }],
      },
      { label: 'Dark Avenger' },
    ],
  },
  {
    label: 'Archer',
    children: [
      {
        label: 'Bow Master',
        children: [{ label: 'Sniper' }, { label: 'Artillery' }],
      },
      {
        label: 'Acrobat',
        children: [{ label: 'Tempest' }, { label: 'Windwalker' }],
      },
      { label: 'Silver Hunter' },
    ],
  },
  {
    label: 'Sorceress',
    children: [
      {
        label: 'Elemental Lord',
        children: [{ label: 'Saleana' }, { label: 'Elestra' }],
      },
      {
        label: 'Force User',
        children: [{ label: 'Smasher' }, { label: 'Majesty' }],
      },
      { label: 'Black Mara' },
    ],
  },
  {
    label: 'Cleric',
    children: [
      {
        label: 'Paladin',
        children: [{ label: 'Guardian' }, { label: 'Crusader' }],
      },
      {
        label: 'Priest',
        children: [{ label: 'Saint' }, { label: 'Inquisitor' }],
      },
      { label: 'Exorcist' },
    ],
  },
  {
    label: 'Academic',
    children: [
      {
        label: 'Engineer',
        children: [{ label: 'Shooting Star' }, { label: 'Gear Master' }],
      },
      {
        label: 'Alchemist',
        children: [{ label: 'Adept' }, { label: 'Physician' }],
      },
      { label: 'Awakening-enhanced versions' },
    ],
  },
  {
    label: 'Kali',
    children: [
      {
        label: 'Dancer',
        children: [{ label: 'Blade Dancer' }, { label: 'Spirit Dancer' }],
      },
      {
        label: 'Screamer',
        children: [{ label: 'Dark Summoner' }, { label: 'Soul Eater' }],
      },
    ],
  },
  {
    label: 'Assassin',
    children: [
      {
        label: 'Chaser',
        children: [{ label: 'Ripper' }, { label: 'Raven' }],
      },
      {
        label: 'Bringer',
        children: [{ label: 'Light Fury' }, { label: 'Abyss Walker' }],
      },
    ],
  },
  {
    label: 'Lancea',
    children: [
      {
        label: 'Piercer',
        children: [{ label: 'Flurry' }, { label: 'Sting Breezer' }],
      },
    ],
  },
  {
    label: 'Machina',
    children: [
      {
        label: 'Patrona',
        children: [{ label: 'Defensio' }, { label: 'Ruina' }],
      },
    ],
  },
  {
    label: 'Vandar',
    children: [{ label: 'Trickster' }, { label: 'Revenant' }],
  },
]

export const CLASS_TIER_LABELS = ['Origin', 'Discipline', 'Ascension']

export function joinClassPath(path: string[]): string {
  return path.join(' > ')
}

export function getClassBase(path: string[]): string {
  return path[0] ?? ''
}

export function isPathPrefix(candidatePath: string[], selectedPath: string[]): boolean {
  return selectedPath.every((segment, index) => candidatePath[index] === segment)
}

export function matchesClassFilter(accountPath: string[], filterPath: string[]): boolean {
  if (filterPath.length === 0) {
    return true
  }

  return isPathPrefix(accountPath, filterPath)
}

export function findNodeByPath(
  path: string[],
  nodes: ClassNode[] = CLASS_TREE,
): ClassNode | null {
  let currentNodes = nodes
  let currentNode: ClassNode | null = null

  for (const segment of path) {
    currentNode = currentNodes.find((node) => node.label === segment) ?? null

    if (!currentNode) {
      return null
    }

    currentNodes = currentNode.children ?? []
  }

  return currentNode
}

export function getPickerColumns(
  selectedPath: string[],
  nodes: ClassNode[] = CLASS_TREE,
): ClassNode[][] {
  const columns: ClassNode[][] = [nodes]
  let currentNodes = nodes

  for (const segment of selectedPath) {
    const currentNode = currentNodes.find((node) => node.label === segment)

    if (!currentNode?.children?.length) {
      break
    }

    columns.push(currentNode.children)
    currentNodes = currentNode.children
  }

  return columns
}

export function buildClassTree(nodes: FlatClassNode[]): ClassNode[] {
  if (nodes.length === 0) {
    return CLASS_TREE
  }

  const map = new Map<string, ClassNode>()
  const orderedNodes = [...nodes].sort((left, right) => left.sort_order - right.sort_order)

  orderedNodes.forEach((node) => {
    map.set(node.id, { label: node.label, children: [] })
  })

  const roots: ClassNode[] = []

  orderedNodes.forEach((node) => {
    const currentNode = map.get(node.id)

    if (!currentNode) {
      return
    }

    if (!node.parent_id) {
      roots.push(currentNode)
      return
    }

    const parentNode = map.get(node.parent_id)

    if (!parentNode) {
      roots.push(currentNode)
      return
    }

    parentNode.children ??= []
    parentNode.children.push(currentNode)
  })

  return roots.map((node) => ({
    ...node,
    children: node.children?.length ? node.children : undefined,
  }))
}

export function flattenClassPaths(
  nodes: ClassNode[],
  currentPath: string[] = [],
): string[][] {
  return nodes.flatMap((node) => {
    const path = [...currentPath, node.label]
    const descendantPaths = node.children?.length
      ? flattenClassPaths(node.children, path)
      : []

    return [path, ...descendantPaths]
  })
}

type CreatedRecord = {
  created_at: string
}

type PathRecord = {
  class_path: string[]
}

export function sortAccountsNewestFirst<T extends CreatedRecord>(accounts: T[]): T[] {
  return [...accounts].sort((left, right) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}

export function filterAccountsByClassPath<T extends PathRecord>(
  accounts: T[],
  filterPath: string[],
): T[] {
  return accounts.filter((account) => matchesClassFilter(account.class_path, filterPath))
}
