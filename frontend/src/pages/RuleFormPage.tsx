import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { createRule, fetchRule, updateRule } from '@/api/client'
import type { FirewallRule, NSGRule } from '@/types/api'
import { Button } from '@/components/ui/button'

const EMPTY_NSG: Omit<NSGRule, 'id' | 'created_at' | 'updated_at' | 'status'> = {
  type: 'nsg',
  name: '',
  priority: 200,
  direction: 'Inbound',
  source: '*',
  destination: '*',
  port: '*',
  protocol: 'TCP',
  action: 'Allow',
  nsg_name: '',
}

const EMPTY_FW: Omit<FirewallRule, 'id' | 'created_at' | 'updated_at' | 'status'> = {
  type: 'firewall',
  name: '',
  rule_type: 'Network',
  rule_collection: '',
  rule_collection_group: '',
  priority: 200,
  action: 'Allow',
  source_ips: '*',
  destination: '*',
  port: '*',
  protocol: 'TCP',
  translated_address: '',
  translated_port: '',
}

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', min, max }: {
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  min?: number
  max?: number
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      className="bg-[#111827] border border-[#1f2937] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400/50 transition-colors w-full"
    />
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#111827] border border-[#1f2937] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400/50 transition-colors w-full"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function NSGForm({ form, setForm }: { form: NSGRule; setForm: (f: NSGRule) => void }) {
  function set(key: keyof NSGRule, value: string | number) {
    setForm({ ...form, [key]: value })
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      <FieldRow label="Rule name" required>
        <Input value={form.name} onChange={(v) => set('name', v)} placeholder="allow-sql-inbound" />
      </FieldRow>
      <FieldRow label="Priority" required>
        <Input type="number" value={form.priority} onChange={(v) => set('priority', parseInt(v) || 200)} min={100} max={4096} />
      </FieldRow>
      <FieldRow label="Direction" required>
        <Select value={form.direction} onChange={(v) => set('direction', v)} options={[
          { value: 'Inbound', label: 'Inbound' },
          { value: 'Outbound', label: 'Outbound' },
        ]} />
      </FieldRow>
      <FieldRow label="Action" required>
        <Select value={form.action} onChange={(v) => set('action', v)} options={[
          { value: 'Allow', label: 'Allow' },
          { value: 'Deny', label: 'Deny' },
        ]} />
      </FieldRow>
      <FieldRow label="Protocol" required>
        <Select value={form.protocol} onChange={(v) => set('protocol', v)} options={[
          { value: 'TCP', label: 'TCP' },
          { value: 'UDP', label: 'UDP' },
          { value: 'Any', label: 'Any' },
        ]} />
      </FieldRow>
      <FieldRow label="Port" required>
        <Input value={form.port} onChange={(v) => set('port', v)} placeholder="443 or 80-90 or *" />
      </FieldRow>
      <FieldRow label="Source" required>
        <Input value={form.source} onChange={(v) => set('source', v)} placeholder="10.0.0.0/16 or *" />
      </FieldRow>
      <FieldRow label="Destination" required>
        <Input value={form.destination} onChange={(v) => set('destination', v)} placeholder="10.1.2.3 or *" />
      </FieldRow>
      <FieldRow label="Target NSG name">
        <Input value={form.nsg_name} onChange={(v) => set('nsg_name', v)} placeholder="nsg-prod-sql-subnet" />
      </FieldRow>
    </div>
  )
}

function FWForm({ form, setForm }: { form: FirewallRule; setForm: (f: FirewallRule) => void }) {
  function set(key: keyof FirewallRule, value: string | number) {
    setForm({ ...form, [key]: value })
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      <FieldRow label="Rule name" required>
        <Input value={form.name} onChange={(v) => set('name', v)} placeholder="allow-web-outbound" />
      </FieldRow>
      <FieldRow label="Priority" required>
        <Input type="number" value={form.priority} onChange={(v) => set('priority', parseInt(v) || 200)} min={100} max={65000} />
      </FieldRow>
      <FieldRow label="Rule type" required>
        <Select value={form.rule_type} onChange={(v) => set('rule_type', v)} options={[
          { value: 'Network', label: 'Network' },
          { value: 'Application', label: 'Application' },
          { value: 'NAT', label: 'NAT' },
        ]} />
      </FieldRow>
      <FieldRow label="Action" required>
        <Select value={form.action} onChange={(v) => set('action', v)} options={[
          { value: 'Allow', label: 'Allow' },
          { value: 'Deny', label: 'Deny' },
        ]} />
      </FieldRow>
      <FieldRow label="Protocol">
        <Select value={form.protocol} onChange={(v) => set('protocol', v)} options={[
          { value: 'TCP', label: 'TCP' },
          { value: 'UDP', label: 'UDP' },
          { value: 'Any', label: 'Any' },
          { value: 'HTTP', label: 'HTTP' },
          { value: 'HTTPS', label: 'HTTPS' },
        ]} />
      </FieldRow>
      <FieldRow label="Port">
        <Input value={form.port} onChange={(v) => set('port', v)} placeholder="443 or *" />
      </FieldRow>
      <FieldRow label="Source IPs/tags">
        <Input value={form.source_ips} onChange={(v) => set('source_ips', v)} placeholder="10.0.0.0/16 or *" />
      </FieldRow>
      <FieldRow label="Destination">
        <Input value={form.destination} onChange={(v) => set('destination', v)} placeholder="10.1.2.3 or *.example.com" />
      </FieldRow>
      <FieldRow label="Rule collection">
        <Input value={form.rule_collection} onChange={(v) => set('rule_collection', v)} placeholder="RC-OutboundWeb" />
      </FieldRow>
      <FieldRow label="Rule collection group">
        <Input value={form.rule_collection_group} onChange={(v) => set('rule_collection_group', v)} placeholder="DefaultNetworkRuleCollectionGroup" />
      </FieldRow>
      {form.rule_type === 'NAT' && (
        <>
          <FieldRow label="Translated address">
            <Input value={form.translated_address} onChange={(v) => set('translated_address', v)} placeholder="10.1.2.3" />
          </FieldRow>
          <FieldRow label="Translated port">
            <Input value={form.translated_port} onChange={(v) => set('translated_port', v)} placeholder="443" />
          </FieldRow>
        </>
      )}
    </div>
  )
}

export default function RuleFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = !!id

  const defaultType = (searchParams.get('type') ?? 'nsg') as 'nsg' | 'firewall'
  const vmParam = searchParams.get('vm')
  const directionParam = searchParams.get('direction') as 'source' | 'destination' | null

  const [ruleType, setRuleType] = useState<'nsg' | 'firewall'>(defaultType)
  const [nsgForm, setNsgForm] = useState<NSGRule>({
    ...EMPTY_NSG,
    id: '',
    status: 'Draft',
    created_at: '',
    updated_at: '',
    source: directionParam === 'source' && vmParam ? vmParam : '*',
    destination: directionParam === 'destination' && vmParam ? vmParam : '*',
  } as NSGRule)
  const [fwForm, setFwForm] = useState<FirewallRule>({
    ...EMPTY_FW,
    id: '',
    status: 'Draft',
    created_at: '',
    updated_at: '',
    source_ips: directionParam === 'source' && vmParam ? vmParam : '*',
    destination: directionParam === 'destination' && vmParam ? vmParam : '*',
  } as FirewallRule)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit && id) {
      fetchRule(id).then((rule) => {
        if (rule.type === 'nsg') {
          setNsgForm(rule as NSGRule)
          setRuleType('nsg')
        } else {
          setFwForm(rule as FirewallRule)
          setRuleType('firewall')
        }
      }).catch(() => toast.error('Failed to load rule'))
    }
  }, [id, isEdit])

  async function handleSave() {
    const rule = ruleType === 'nsg' ? nsgForm : fwForm
    if (!rule.name.trim()) {
      toast.error('Rule name is required')
      return
    }
    setSaving(true)
    try {
      if (isEdit && id) {
        await updateRule(id, rule)
        toast.success('Rule updated')
      } else {
        await createRule(rule)
        toast.success('Draft saved')
      }
      navigate('/rules')
    } catch {
      toast.error('Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-slate-100 mb-1">
        {isEdit ? 'Edit Rule' : 'New Rule'}
      </h1>
      {vmParam && (
        <p className="text-xs text-slate-500 mb-4">
          Pre-filled for VM: <span className="font-mono text-cyan-400">{vmParam}</span>
          {directionParam && ` as ${directionParam}`}
        </p>
      )}

      {/* WIP banner */}
      <div className="mb-5 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Deployment not enabled in v1.3. Drafts are saved for planning purposes only.
      </div>

      {/* Type selector (only for new rules) */}
      {!isEdit && (
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setRuleType('nsg')}
            className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
              ruleType === 'nsg'
                ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                : 'border-[#1f2937] text-slate-500 hover:border-[#374151]'
            }`}
          >
            NSG Rule
          </button>
          <button
            onClick={() => setRuleType('firewall')}
            className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
              ruleType === 'firewall'
                ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                : 'border-[#1f2937] text-slate-500 hover:border-[#374151]'
            }`}
          >
            Firewall Rule
          </button>
        </div>
      )}

      <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-5 mb-5">
        {ruleType === 'nsg' ? (
          <NSGForm form={nsgForm} setForm={setNsgForm} />
        ) : (
          <FWForm form={fwForm} setForm={setFwForm} />
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/20 text-xs"
          size="sm"
        >
          {saving ? 'Saving...' : 'Save draft'}
        </Button>
        <Button
          disabled
          size="sm"
          variant="ghost"
          className="text-xs text-slate-600 cursor-not-allowed"
          title="Not implemented yet — coming in a future release"
        >
          Deploy to Azure
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-500"
          onClick={() => navigate('/rules')}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
