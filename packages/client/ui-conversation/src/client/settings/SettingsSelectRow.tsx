/** Shared General Settings selector: title, description, and a Menu of options. */
import { useState } from 'react'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './EnterBehaviorRow.module.css'

/**
 * Render a General Settings preference as title, description, and a Menu selector.
 * @param props.title - localized row title.
 * @param props.description - localized row description.
 * @param props.items - already-localized menu options.
 * @param props.selectedId - current option id.
 * @param props.selectedLabel - already-localized selected option label.
 * @param props.onSelect - persist the chosen option id.
 * @returns the settings row.
 */
export function SettingsSelectRow<Id extends string>({
  title, description, items, selectedId, selectedLabel, onSelect,
}: {
  title: string
  description: string
  items: readonly { id: Id; label: string }[]
  selectedId: Id
  selectedLabel: string
  onSelect: (id: Id) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{title}</div>
        <div className={css.desc}>{description}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={[...items]}
        selectedId={selectedId}
        onSelect={(id) => {
          setOpen(false)
          const selected = items.find(item => item.id === id)
          if (selected === undefined) return
          onSelect(selected.id)
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { setOpen(value => !value) }}
          >
            {selectedLabel}
            <IconChevronDownOutline14 className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}
