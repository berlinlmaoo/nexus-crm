import { createClient } from '@/lib/supabase/server'

export default async function TestConnectionPage() {
  const supabase = createClient()
  
  // Test connection to the "products" table
  console.log("Testing connection... URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
  
  let result = null
  let testError = null
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(5)
      
    if (error) {
      testError = error
    } else {
      result = data
    }
  } catch (err: any) {
    testError = err
  }

  return (
    <div className="min-h-screen bg-stone-50 p-8 flex justify-center py-12">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 mb-6">Database Connection Test</h1>
        
        {testError ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-md shadow-sm">
            <h2 className="text-red-800 font-bold text-lg flex items-center gap-2">
              <span className="text-xl">🚨</span> Connection Failed
            </h2>
            <div className="mt-4 bg-red-100 p-3 rounded text-red-900 font-mono text-sm overflow-x-auto">
              <pre>{JSON.stringify(testError, null, 2)}</pre>
            </div>
            <p className="mt-4 text-red-700 text-sm">
              Please double check your <b>.env.local</b> file and ensure the URL and Keys are correct.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 p-6 rounded-xl shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-stone-100">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-600 text-xl font-bold">✓</span>
              </div>
              <div>
                <h2 className="text-emerald-700 font-bold text-lg">Successfully Connected!</h2>
                <p className="text-stone-500 text-sm">Supabase connection established via SSR client.</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-stone-800 mb-3 text-sm uppercase tracking-wider">Sample Data (Products Table)</h3>
              
              {result && result.length > 0 ? (
                <div className="bg-stone-900 rounded-lg overflow-hidden shadow-inner">
                  <pre className="p-4 text-emerald-400 font-mono text-xs overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-800">
                  <p className="font-medium text-sm">✅ Table exists and can be queried.</p>
                  <p className="text-xs mt-1 opacity-80">However, the `products` table currently has 0 rows. It is ready for the Seed script (Phase 3).</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
