import type { FirewallRule, NSGRule, RuleModel } from '@/types/api'

export function generateCliExport(rules: RuleModel[]): string {
  const lines: string[] = [
    `# AzureNetMap rule export — ${new Date().toISOString()}`,
    '# Review before applying. Replace <RG> and <NSG-NAME> placeholders.',
    '',
  ]

  for (const rule of rules) {
    if (rule.type === 'nsg') {
      const r = rule as NSGRule
      lines.push(`# NSG rule: ${r.name}`)
      lines.push(`az network nsg rule create \\`)
      lines.push(`  --resource-group <RG> \\`)
      lines.push(`  --nsg-name ${r.nsg_name || '<NSG-NAME>'} \\`)
      lines.push(`  --name ${r.name} \\`)
      lines.push(`  --priority ${r.priority} \\`)
      lines.push(`  --direction ${r.direction} \\`)
      lines.push(`  --access ${r.action} \\`)
      lines.push(`  --protocol ${r.protocol} \\`)
      lines.push(`  --source-address-prefixes '${r.source}' \\`)
      lines.push(`  --destination-address-prefixes '${r.destination}' \\`)
      lines.push(`  --destination-port-ranges ${r.port}`)
      lines.push('')
    } else {
      const r = rule as FirewallRule
      lines.push(`# Firewall rule: ${r.name} (${r.rule_type})`)
      lines.push(`# Collection: ${r.rule_collection || '<COLLECTION>'}, Group: ${r.rule_collection_group || '<GROUP>'}`)
      lines.push(`# Priority: ${r.priority}, Action: ${r.action}`)
      lines.push(`# Source: ${r.source_ips}, Destination: ${r.destination}, Port: ${r.port}`)
      if (r.rule_type === 'NAT') {
        lines.push(`# Translated: ${r.translated_address}:${r.translated_port}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

export function ruleToHuman(rule: RuleModel): string {
  if (rule.type === 'nsg') {
    const r = rule as NSGRule
    return `${r.action} ${r.protocol} from ${r.source} to ${r.destination} on port ${r.port} (priority ${r.priority}, ${r.direction.toLowerCase()})`
  }
  const r = rule as FirewallRule
  return `[${r.rule_type}] ${r.action} ${r.protocol} from ${r.source_ips} to ${r.destination} on port ${r.port}`
}
