import type { Ref } from 'vue'
import { watch, computed, ref, reactive } from 'vue'

type GetDataByRequest<T> = T extends (...args: any[]) => Promise<infer R>
  ? R extends { list?: infer D }
    ? D
    : never
  : never

type PromiseFn = (...args: any[]) => Promise<any>

type Pagination = {
  page: number
  limit: number
  offset: number
  total: number
}

type DefaultParams = Partial<Pagination> & Record<string, any>

type RunParams<T extends PromiseFn, P> =
  | (Parameters<T>[number] & Partial<P>)
  | Parameters<T>[number]

/**
 * 通用list请求函数
 * @param fn 请求函数
 * @param defaultParams 默认可选参数
 * @returns
 */
export function useListRequest<T extends PromiseFn, D extends DefaultParams>(
  fn: T,
  defaultParams?: D
) {
  const loading = ref(false)
  const data = ref([]) as Ref<GetDataByRequest<T>>
  const pagination = reactive<Pagination>({
    page: 1,
    limit: 20,
    offset: 0,
    total: 0,
  })

  const run = async (params?: RunParams<T, D>, ...args: any[]) => {
    loading.value = true
    try {
      const { page, limit } = pagination
      const res = await fn(
        { ...defaultParams, page, limit, ...params },
        ...args
      )

      data.value = res.list
      pagination.total = res.total
    } finally {
      loading.value = false
    }
  }

  return { loading, run, data, pagination }
}

type GetSwitchData<K, T> = T extends (
  | [K, PromiseFn]
  | [K, PromiseFn, DefaultParams]
)[]
  ? GetDataByRequest<T[number][1]>
  : never

type GetSwitchRun<K, T> = T extends (
  | [K, infer R extends PromiseFn]
  | [K, infer R extends PromiseFn, infer D extends DefaultParams]
)[]
  ? (params?: RunParams<R, D>, ...args: any[]) => Promise<void>
  : never

type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends Array<any> ? DeepReadonly<T[K]> : T[K]
}

type NoReadonly<T> = {
  -readonly [K in keyof T]: T[K] extends ReadonlyArray<any>
    ? NoReadonly<T[K]>
    : T[K]
}

type SwitchFnList<T> = DeepReadonly<
  ([T, PromiseFn, DefaultParams] | [T, PromiseFn])[]
>

/**
 * 多个请求函数切换
 * @param active 切换的值
 * @param switchFnList 切换的函数列表，参数后加上as const, [active, fn][] | [active, fn, defaultParams][]
 * @returns
 */
export function useSwitchRequest<T, S extends SwitchFnList<T>>(
  active: Ref<T>,
  switchFnList: S
) {
  const requestList = switchFnList.map(([a, b, c]) => [
    a,
    useListRequest(b, c),
  ]) as [keyof T, ReturnType<typeof useListRequest>][]

  const request = computed(() => {
    const item = requestList.find(([a]) => a === active.value)!
    return item[1]
  })

  const loading = computed(() => request.value.loading.value)
  const data = computed(
    () =>
      request.value.data.value as unknown as GetSwitchData<
        NoReadonly<T>,
        NoReadonly<S>
      >
  )

  const run = computed(
    () =>
      request.value.run as unknown as GetSwitchRun<NoReadonly<T>, NoReadonly<S>>
  )

  const pagination = computed(() => request.value.pagination)

  watch(active, () => {
    pagination.value.page = 1
  })
  return reactive({ loading, data, run, pagination })
}
