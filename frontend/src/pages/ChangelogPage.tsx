import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

async function fetchChangelog(): Promise<string> {
  const res = await fetch('/api/changelog')
  if (!res.ok) throw new Error('Failed to load changelog')
  const data = await res.json()
  return data.content as string
}

export default function ChangelogPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['changelog'],
    queryFn: fetchChangelog,
    staleTime: Infinity,
  })

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={12} />
          Back to dashboard
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`h-4 bg-[#111827] rounded animate-pulse ${i % 3 === 0 ? 'w-1/3' : 'w-full'}`} />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-red-400 text-sm">Failed to load changelog.</div>
      )}

      {data && (
        <div className="prose prose-invert prose-sm max-w-none
          prose-headings:text-slate-100 prose-headings:font-semibold
          prose-h1:text-2xl prose-h2:text-lg prose-h2:border-b prose-h2:border-[#1f2937] prose-h2:pb-2 prose-h2:mt-8
          prose-h3:text-base prose-h3:text-slate-300
          prose-p:text-slate-400 prose-p:leading-relaxed
          prose-li:text-slate-400
          prose-code:text-cyan-300 prose-code:bg-[#111827] prose-code:px-1 prose-code:rounded prose-code:text-sm
          prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-[#1f2937] prose-pre:rounded-lg
          prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:text-cyan-300
          prose-strong:text-slate-200
          prose-hr:border-[#1f2937]
          prose-table:text-sm prose-th:text-slate-400 prose-td:text-slate-500
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
