module.exports = {
  disableEmoji: false,
  list: ['test', 'feat', 'fix', 'chore', 'docs', 'refactor', 'style', 'ci', 'perf', 'release', 'revert', 'build'],
  maxMessageLength: 64,
  minMessageLength: 3,
  questions: ['type', 'scope', 'subject', 'body', 'breaking', 'issues', 'lerna'],
  scopes: [],
  types: {
    chore: {
      description: 'Chore | 构建/工程依赖/工具',
      emoji: '🚀', // 当前类型的commit所显示的表情
      value: 'chore'
    },
    ci: {
      description: 'Continuous Integration | CI 配置',
      emoji: '👷',
      value: 'ci'
    },
    docs: {
      description: 'Documentation | 文档',
      emoji: '✏️ ',
      value: 'docs'
    },
    feat: {
      description: 'Features | 新功能',
      emoji: '✨',
      value: 'feat'
    },
    fix: {
      description: 'Bug Fixes | Bug 修复',
      emoji: '🐛',
      value: 'fix'
    },
    perf: {
      description: 'Performance Improvements | 性能优化',
      emoji: '⚡',
      value: 'perf'
    },
    refactor: {
      description: 'Code Refactoring | 代码重构',
      emoji: '♻️ ',
      value: 'refactor'
    },
    release: {
      description: 'Create a release commit | 发版提交',
      emoji: '🏹',
      value: 'release'
    },
    style: {
      description: 'Styles | 风格',
      emoji: '💄',
      value: 'style'
    },
    revert: {
      description: 'Revert | 回退',
      emoji: '⏪',
      value: 'revert'
    },
    build: {
      description: 'Build System | 打包构建',
      emoji: '📦',
      value: 'build'
    },
    test: {
      description: 'Tests | 测试',
      emoji: '✅',
      value: 'test'
    }
  }
}
