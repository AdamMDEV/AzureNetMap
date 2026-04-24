export type Env = 'prod' | 'dev' | 'hub' | 'external'
export type FlowType = 'Allowed' | 'Denied' | 'Unknown'
export type FlowFilter = 'allowed' | 'denied' | 'all'
export type EnvFilter = 'prod' | 'dev' | 'hub' | 'all'

export interface NodeData {
  id: string
  label: string
  env: Env
  ip: string
  vm_name: string
  subnet: string
  vnet: string
  bytes_total: number
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

export interface TopologyResponse {
  nodes: Array<{ data: NodeData }>
  edges: Array<{ data: EdgeData }>
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
}
