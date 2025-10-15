// stores/apiStore.ts
import { defineStore } from 'pinia'
import { reactive } from 'vue'

interface SelectedApi {
  id: number | null
  URL: string
  key: string
  name: string
  time: string
}

export const apiStore = defineStore('apiSettings', () => {
  const selectedApi = reactive({
    id: null as number | null,
    URL: '',
    key: '',
    name: '',
    time: ''
  })

  function setSelectedApi(api: SelectedApi) {
    Object.assign(selectedApi, api)
  }
  
  function clearSelectedApi() {
    selectedApi.id = null
    selectedApi.URL = ''
    selectedApi.key = ''
    selectedApi.name = ''
    selectedApi.time = ''
  }

  return { selectedApi, setSelectedApi, clearSelectedApi }
}, {
  persist: {
    key: 'apiSettings',
    storage: localStorage
  }
})