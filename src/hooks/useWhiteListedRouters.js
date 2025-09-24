import { useEffect, useState } from 'react'
import useAggregatorContract from './useAggregatorContract'

export default function useWhiteListedRouters() {
  const aggregator = useAggregatorContract()
  const [routers, setRouters] = useState([])

  useEffect(() => {
    const fetchRouters = async () => {
      if (!aggregator) return
      try {
        const count = await aggregator.getRouterCount()
        const total = Number(count)
        const items = []
        for (let i = 0; i < total; i++) {
          items.push(await aggregator.getRouterAt(i))
        }
        setRouters(items)
      } catch (e) {
        console.error('Erro ao buscar routers whitelist:', e)
      }
    }

    fetchRouters()
  }, [aggregator])

  return routers
}
