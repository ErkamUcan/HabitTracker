'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  tasks: {
    list: (scope, dateKey) => ipcRenderer.invoke('tasks:list', scope, dateKey),
    add: (data) => ipcRenderer.invoke('tasks:add', data),
    update: (id, text) => ipcRenderer.invoke('tasks:update', id, text),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
    toggle: (id, done) => ipcRenderer.invoke('tasks:toggle', id, done)
  },
  habits: {
    list: () => ipcRenderer.invoke('habits:list'),
    add: (name) => ipcRenderer.invoke('habits:add', name),
    rename: (id, name) => ipcRenderer.invoke('habits:rename', id, name),
    delete: (id) => ipcRenderer.invoke('habits:delete', id),
    mark: (habitId, date, done) => ipcRenderer.invoke('habits:mark', habitId, date, done),
    getMarks: (year, month) => ipcRenderer.invoke('habits:getMarks', year, month),
    getMarksForDates: (dates) => ipcRenderer.invoke('habits:getMarksForDates', dates)
  },
  streaks: {
    get: () => ipcRenderer.invoke('streaks:get')
  },
  kpss: {
    listCategories: () => ipcRenderer.invoke('kpss:listCategories'),
    addCategory: (name) => ipcRenderer.invoke('kpss:addCategory', name),
    renameCategory: (id, name) => ipcRenderer.invoke('kpss:renameCategory', id, name),
    setCategoryColor: (id, color) => ipcRenderer.invoke('kpss:setCategoryColor', id, color),
    deleteCategory: (id) => ipcRenderer.invoke('kpss:deleteCategory', id),
    listTopics: (categoryId) => ipcRenderer.invoke('kpss:listTopics', categoryId),
    addTopic: (categoryId, text) => ipcRenderer.invoke('kpss:addTopic', categoryId, text),
    addTopicsBulk: (categoryId, texts) => ipcRenderer.invoke('kpss:addTopicsBulk', categoryId, texts),
    updateTopic: (id, text) => ipcRenderer.invoke('kpss:updateTopic', id, text),
    deleteTopic: (id) => ipcRenderer.invoke('kpss:deleteTopic', id),
    deleteTopics: (ids) => ipcRenderer.invoke('kpss:deleteTopics', ids),
    toggleTopic: (id, done) => ipcRenderer.invoke('kpss:toggleTopic', id, done),
    reorderCategories: (updates) => ipcRenderer.invoke('kpss:reorderCategories', updates)
  },
  lessons: {
    list: () => ipcRenderer.invoke('lessons:list'),
    add: (name, color) => ipcRenderer.invoke('lessons:add', name, color),
    rename: (id, name) => ipcRenderer.invoke('lessons:rename', id, name),
    setColor: (id, color) => ipcRenderer.invoke('lessons:setColor', id, color),
    delete: (id) => ipcRenderer.invoke('lessons:delete', id),
    reorder: (updates) => ipcRenderer.invoke('lessons:reorder', updates)
  },
  videos: {
    list: () => ipcRenderer.invoke('videos:list'),
    add: (data) => ipcRenderer.invoke('videos:add', data),
    bulkAdd: (items) => ipcRenderer.invoke('videos:bulkAdd', items),
    update: (id, data) => ipcRenderer.invoke('videos:update', id, data),
    delete: (id) => ipcRenderer.invoke('videos:delete', id),
    deleteMany: (ids) => ipcRenderer.invoke('videos:deleteMany', ids),
    toggle: (id, done) => ipcRenderer.invoke('videos:toggle', id, done)
  },
  shell: {
    open: (url) => ipcRenderer.invoke('shell:open', url)
  },
  quotes: {
    get: () => ipcRenderer.invoke('quotes:get'),
    refresh: () => ipcRenderer.invoke('quotes:refresh')
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },
  export: {
    toJSON: () => ipcRenderer.invoke('export:json'),
    toExcel: () => ipcRenderer.invoke('export:excel')
  },
  mockExams: {
    listAll: () => ipcRenderer.invoke('mock:exams:listAll'),
    add: (data) => ipcRenderer.invoke('mock:exams:add', data),
    update: (id, data) => ipcRenderer.invoke('mock:exams:update', id, data),
    delete: (id) => ipcRenderer.invoke('mock:exams:delete', id),
    stats: { get: (rangeStart) => ipcRenderer.invoke('mock:stats:get', rangeStart) },
    wrongTopics: {
      save: (sectionId, topics) => ipcRenderer.invoke('mock:wrongTopics:save', sectionId, topics),
      getByExam: (examId) => ipcRenderer.invoke('mock:wrongTopics:getByExam', examId),
      update: (id, data) => ipcRenderer.invoke('mock:wrongTopics:update', id, data),
      delete: (id) => ipcRenderer.invoke('mock:wrongTopics:delete', id),
    },
    allTopics: { get: () => ipcRenderer.invoke('mock:allTopics:get') },
    topicStats: { get: (rangeStart) => ipcRenderer.invoke('mock:stats:topics', rangeStart) },
  },
  practice: {
    sessions: {
      list: () => ipcRenderer.invoke('practice:sessions:list'),
      add: (data) => ipcRenderer.invoke('practice:sessions:add', data),
      update: (id, data) => ipcRenderer.invoke('practice:sessions:update', id, data),
      delete: (id) => ipcRenderer.invoke('practice:sessions:delete', id),
    },
    queue: {
      list: () => ipcRenderer.invoke('practice:queue:list'),
      add: (data) => ipcRenderer.invoke('practice:queue:add', data),
      update: (id, data) => ipcRenderer.invoke('practice:queue:update', id, data),
      delete: (id) => ipcRenderer.invoke('practice:queue:delete', id),
      markDone: (id, done) => ipcRenderer.invoke('practice:queue:markDone', id, done),
    },
    stats: {
      get: (rangeStart) => ipcRenderer.invoke('practice:stats:get', rangeStart),
    },
    topicStats: {
      get: () => ipcRenderer.invoke('practice:topic-stats:get'),
    },
  },
  breaks: {
    add: (data) => ipcRenderer.invoke('breaks:add', data),
    stats: (rangeStart) => ipcRenderer.invoke('breaks:stats', rangeStart),
  },
  goals: {
    add: (data) => ipcRenderer.invoke('goal:add', data),
    list: (rangeStart) => ipcRenderer.invoke('goal:list', rangeStart),
  },
  study: {
    subjects: {
      list: () => ipcRenderer.invoke('study:subjects:list'),
      add: (name, kpss_category_id) => ipcRenderer.invoke('study:subjects:add', name, kpss_category_id),
      update: (id, name, kpss_category_id) => ipcRenderer.invoke('study:subjects:update', id, name, kpss_category_id),
      delete: (id) => ipcRenderer.invoke('study:subjects:delete', id),
      getOrCreate: (kpss_category_id, name) => ipcRenderer.invoke('study:subjects:getOrCreate', kpss_category_id, name),
    },
    session: {
      getState: () => ipcRenderer.invoke('study:session:getState'),
      start: (subjectId, topicText) => ipcRenderer.invoke('study:session:start', subjectId, topicText),
      pause: () => ipcRenderer.invoke('study:session:pause'),
      resume: () => ipcRenderer.invoke('study:session:resume'),
      stop: () => ipcRenderer.invoke('study:session:stop'),
      cancel: () => ipcRenderer.invoke('study:session:cancel'),
      switch: (subjectId, topicText) => ipcRenderer.invoke('study:session:switch', subjectId, topicText),
      checkRecovery: () => ipcRenderer.invoke('study:session:checkRecovery'),
      dismissRecovery: (segmentId, keepTime) => ipcRenderer.invoke('study:session:dismissRecovery', segmentId, keepTime),
    },
    manual: {
      add: (data) => ipcRenderer.invoke('study:manual:add', data),
    },
    segments: {
      delete: (id) => ipcRenderer.invoke('study:segments:delete', id),
      deleteDay: (date) => ipcRenderer.invoke('study:segments:deleteDay', date),
    },
    stats: {
      get: (rangeStart) => ipcRenderer.invoke('study:stats:get', rangeStart),
      heatmap: () => ipcRenderer.invoke('study:stats:heatmap'),
    },
    widget: {
      open: () => ipcRenderer.invoke('study:widget:open'),
      close: () => ipcRenderer.invoke('study:widget:close'),
    },
    on: {
      stateChange: (cb) => { ipcRenderer.on('study:event:stateChange', (_, d) => cb(d)) },
      idle: (cb) => { ipcRenderer.on('study:event:idle', (_, d) => cb(d)) },
      sleepRecovery: (cb) => { ipcRenderer.on('study:event:sleepRecovery', (_, d) => cb(d)) },
    },
    off: {
      stateChange: () => ipcRenderer.removeAllListeners('study:event:stateChange'),
      idle: () => ipcRenderer.removeAllListeners('study:event:idle'),
      sleepRecovery: () => ipcRenderer.removeAllListeners('study:event:sleepRecovery'),
    },
  }
})
