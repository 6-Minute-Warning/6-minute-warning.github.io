import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeView from '../HomeView.vue'

describe('HomeView', () => {
  it('names the app', () => {
    expect(mount(HomeView).text()).toContain('6MW Backstage')
  })
})
