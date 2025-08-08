import DefaultTheme from 'vitepress/theme'
import RepoItem from '../components/RepoItem.vue'
import RepositoryItem from '../components/RepositoryItem.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('RepoItem', RepoItem)
    app.component('RepositoryItem', RepositoryItem)
  }
}