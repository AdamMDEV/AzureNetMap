import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Copy,
  Download,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { fetchRules, deleteRule } from '@/api/client'
import { generateCliExport, ruleToHuman } from '@/lib/rule-cli-export'
import type { FirewallRule, NSGRule, RuleModel } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

function ActionBadge({ action }: { action: string }) {
  const green = action === 'Allow'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
      green ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'
    }`}>
      {action}
    </span>
  )
}

function DirectionBadge({ dir }: { dir: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
      {dir}
    </span>
  )
}

function NSGRuleCard({ rule, onEdit, onDelete }: { rule: NSGRule; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-4 space-y-2 hover:border-[#374151] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-slate-200 font-medium">{rule.name}</span>
            <ActionBadge action={rule.action} />
            <DirectionBadge dir={rule.direction} />
            <span className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
              Priority {rule.priority}
            </span>
            <span className="text-[10px] text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Draft
            </span>
          </div>
          {rule.nsg_name && (
            <div className="text-[11px] text-slate-500 font-mono mt-1">NSG: {rule.nsg_name}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7" aria-label="Edit rule">
            <Pencil size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-7 w-7 text-slate-600 hover:text-red-400"
            aria-label="Delete rule"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
      <div className="text-[11px] text-slate-500 bg-[#111827] rounded-md px-3 py-2 font-mono leading-relaxed">
        {ruleToHuman(rule)}
      </div>
      <div className="text-[10px] text-slate-700">
        Created {new Date(rule.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

function FWRuleCard({ rule, onEdit, onDelete }: { rule: FirewallRule; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-4 space-y-2 hover:border-[#374151] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-slate-200 font-medium">{rule.name}</span>
            <ActionBadge action={rule.action} />
            <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{rule.rule_type}</span>
            <span className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
              Priority {rule.priority}
            </span>
            <span className="text-[10px] text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Draft
            </span>
          </div>
          {rule.rule_collection && (
            <div className="text-[11px] text-slate-500 font-mono mt-1">Collection: {rule.rule_collection}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7" aria-label="Edit rule">
            <Pencil size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-7 w-7 text-slate-600 hover:text-red-400"
            aria-label="Delete rule"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
      <div className="text-[11px] text-slate-500 bg-[#111827] rounded-md px-3 py-2 font-mono leading-relaxed">
        {ruleToHuman(rule)}
      </div>
      <div className="text-[10px] text-slate-700">
        Created {new Date(rule.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

function ExportDialog({ open, onClose, rules }: { open: boolean; onClose: () => void; rules: RuleModel[] }) {
  const cli = generateCliExport(rules)
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1117] border-[#1f2937] max-w-2xl w-full">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Export as Azure CLI</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(cli).then(() => toast.success('Copied'))
                }}
              >
                <Copy size={12} /> Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => {
                  const blob = new Blob([cli], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'rule-drafts.sh'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download size={12} /> Download .sh
              </Button>
            </div>
          </div>
          <ScrollArea className="h-80 rounded-lg bg-[#111827] border border-[#1f2937]">
            <pre className="p-4 text-[11px] text-slate-300 font-mono whitespace-pre">{cli}</pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function RulesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [exportOpen, setExportOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'nsg' | 'firewall'>('nsg')

  const { data, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: fetchRules,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      toast.success('Rule deleted')
    },
    onError: () => toast.error('Failed to delete rule'),
  })

  const rules = data?.items ?? []
  const nsgRules = rules.filter((r): r is NSGRule => r.type === 'nsg')
  const fwRules = rules.filter((r): r is FirewallRule => r.type === 'firewall')

  function EmptyState({ type }: { type: 'nsg' | 'firewall' }) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
        <Lock size={32} />
        <div className="text-sm">No {type === 'nsg' ? 'NSG' : 'firewall'} drafts yet.</div>
        <div className="text-xs">Click &quot;+ New Rule&quot; to start.</div>
        <Button
          size="sm"
          variant="ghost"
          className="text-cyan-400 hover:text-cyan-300 text-xs mt-1"
          onClick={() => navigate(`/rules/new?type=${type}`)}
        >
          <Plus size={12} /> New {type === 'nsg' ? 'NSG' : 'Firewall'} Rule
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      {/* WIP Banner */}
      <div className="mb-4 flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
        <span>
          <strong>Work in progress</strong> — Read-only. Rule deployment is not yet enabled.
          Drafts are saved locally but cannot be applied to Azure resources.
        </span>
      </div>

      {/* Access control banner */}
      <div className="mb-5 flex items-center gap-2 p-2.5 rounded-lg bg-[#0d1117] border border-[#1f2937] text-[11px] text-slate-500">
        <Lock size={11} className="shrink-0" />
        Read-only preview — role-based access controls for rule deployment will be added when deployment is enabled.
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Rule Planner</h1>
          <p className="text-sm text-slate-500 mt-1">Draft NSG and Azure Firewall rules before deployment</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-400"
            onClick={() => setExportOpen(true)}
            disabled={rules.length === 0}
          >
            <Download size={12} /> Export drafts
          </Button>
          <Button
            size="sm"
            className="text-xs bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/20"
            onClick={() => navigate('/rules/new')}
          >
            <Plus size={12} /> New Rule
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'nsg' | 'firewall')}>
        <TabsList className="bg-transparent border-b border-[#1f2937] rounded-none h-9 justify-start px-0 gap-1 mb-5">
          <TabsTrigger value="nsg">
            NSG Rules
            {nsgRules.length > 0 && (
              <span className="ml-1.5 text-[10px] text-slate-600">({nsgRules.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="firewall">
            Firewall Rules
            {fwRules.length > 0 && (
              <span className="ml-1.5 text-[10px] text-slate-600">({fwRules.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nsg" className="mt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-[#0d1117] border border-[#1f2937] rounded-xl animate-pulse" />)}
            </div>
          ) : nsgRules.length === 0 ? (
            <EmptyState type="nsg" />
          ) : (
            <div className="space-y-3">
              {nsgRules.map((rule) => (
                <NSGRuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => navigate(`/rules/${rule.id}/edit`)}
                  onDelete={() => deleteMutation.mutate(rule.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="firewall" className="mt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-[#0d1117] border border-[#1f2937] rounded-xl animate-pulse" />)}
            </div>
          ) : fwRules.length === 0 ? (
            <EmptyState type="firewall" />
          ) : (
            <div className="space-y-3">
              {fwRules.map((rule) => (
                <FWRuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => navigate(`/rules/${rule.id}/edit`)}
                  onDelete={() => deleteMutation.mutate(rule.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} rules={rules} />
    </div>
  )
}
