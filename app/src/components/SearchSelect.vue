<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { search, slug } from '@/lib/directory'

const props = defineProps<{ label: string; options: string[]; newLabel: string }>()
const model = defineModel<string>({ required: true })

const id = useId()
const open = ref(false)
const active = ref(-1)
const typed = computed(() => model.value.trim())
const matches = computed(() => search(model.value, props.options))
const isNew = computed(() => !!typed.value && !props.options.some((o) => slug(o) === slug(typed.value)))
const choices = computed(() => (isNew.value ? [...matches.value, typed.value] : matches.value))

function pick(value: string) {
  model.value = value
  open.value = false
}

function key(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    const count = choices.value.length
    if (!count) return
    active.value = event.key === 'ArrowDown' ? (active.value + 1) % count : (active.value - 1 + count) % count
  } else if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    const choice = choices.value[active.value]
    if (choice) pick(choice)
    else open.value = false
  } else if (event.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="search">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      role="combobox"
      autocomplete="off"
      maxlength="160"
      :aria-expanded="open && choices.length > 0"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="open && active >= 0 ? `${id}-${active}` : undefined"
      @focus="open = true"
      @input="((open = true), (active = -1))"
      @keydown="key"
      @blur="open = false"
    />
    <span v-if="isNew" class="new">{{ newLabel }}</span>
    <ul v-show="open && choices.length" :id="`${id}-list`" role="listbox" class="list">
      <li
        v-for="(c, i) in choices"
        :id="`${id}-${i}`"
        :key="c + i"
        role="option"
        :aria-selected="i === active"
        @mousedown.prevent="pick(c)"
      >
        <template v-if="isNew && i === choices.length - 1">Add “{{ c }}”</template>
        <template v-else>{{ c }}</template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  display: grid;
  gap: 4px;
  font-weight: 600;
  font-size: 0.9rem;
}

.new {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-warning);
}

.list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 5;
  margin: 4px 0 0;
  padding: 4px 0;
  list-style: none;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  max-height: 260px;
  overflow-y: auto;
}

.list li {
  padding: 8px 12px;
  font-weight: 500;
  cursor: pointer;
}

.list li[aria-selected='true'] {
  background: var(--color-accent);
  color: var(--color-accent-ink);
}
</style>
