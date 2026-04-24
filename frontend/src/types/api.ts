export type Env = 'prod' | 'dev' | 'hub' | 'external' | 'unattributed'
export type FlowType = 'Allowed' | 'Denied' | 'Unknown'
export type FlowFilter = 'allowed' | 'denied' | 'all'
export type EnvFilter = 'prod' | 'dev' | 'hub' | 'all'
export type GroupingMode = 'none' | 'subnet' | 'vnet'
export type LayoutMode = 'fcose' | 'concentric' | 'breadthfirst' | 'grid'

export interface NodeData {
  id: string
  label: string
  env: Env
  ip: string
  vm_name: string
  subnet: string
  vnet: string
  subscription: string
  bytes_total: number
  peer_count: number
}

export interface EdgeData {
  id: string
  source: string
  target: string
  bytes_total: number
  packets_total: number
  flow_count: number
  flow_type: FlowType
  acl_rules: string[]
  dest_ports: (string | number)[]
  protocols: string[]
}

export interface SubnetGroup {
  id: string
  name: string
  vnet: string
  env: string
  node_count: number
  total_bytes: number
}

export interface VNetGroup {
  id: string
  name: string
  env: string
  subnet_count: number
  node_count: number
}

export interface TopologySummary {
  total_bytes: number
  total_packets: number
  allow_count: number
  deny_count: number
  unattributed_count: number
}

export interface TopologyResponse {
  nodes: Array<{ data: NodeData }>
  edges: Array<{ data: EdgeData }>
  subnets: SubnetGroup[]
  vnets: VNetGroup[]
  summary: TopologySummary
}

export interface FlowRecord {
  time_generated: string
  direction: string
  src_ip: string
  dest_ip: string
  src_vm: string
  dest_vm: string
  dest_port: string | number | null
  protocol: string
  flow_type: string
  flow_status: string
  acl_rule: string
  bytes_src_to_dest: number
  bytes_dest_to_src: number
}

export interface VMInfo {
  name: string
  ip: string
  subnet: string
  vnet: string
}

export interface FirewallHit {
  source_ip: string
  destination_ip: string
  destination_port: string | number | null
  protocol: string
  rule_type: string
  hit_count: number
  rules: string[]
  actions: string[]
  policies: string[]
}

export interface VMDetailResponse {
  vm: VMInfo
  inbound: FlowRecord[]
  outbound: FlowRecord[]
  firewall_hits: FirewallHit[]
}

export interface SearchEntry {
  vm_name: string
  ip: string
  subnet: string
  vnet: string
}

export interface SearchResponse {
  results: SearchEntry[]
}

export interface HealthResponse {
  status: string
  timestamp: string
  law_reachable: boolean
  cache_stats: Record<string, { size: number; maxsize: number; ttl: number }>
}

export interface TopologyFilters {
  env: EnvFilter
  flow_type: FlowFilter
  hours: number
  include_unattributed: boolean
  density_threshold: number
}
