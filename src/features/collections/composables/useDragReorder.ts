import { ref } from 'vue'

/**
 * HTML5 DnD「手柄武装」模式的拖拽调序状态机（从 SelectedDatasetList 抽出共用）。
 *
 * 只有按住拖拽手柄 pointerdown 后行才 draggable（armed），行内其他区域
 * （按钮/文本）不受影响。drop 时回调 onReorder(from, to)（splice 语义）；
 * dragend 对取消拖拽/拖到列表外也会触发，统一在 resetDrag 复位。
 * 触屏/键盘不可用 DnD，调用方需另行提供上移/下移按钮。
 */
export function useDragReorder(onReorder: (from: number, to: number) => void) {
  const armed = ref(false)
  const dragFrom = ref(-1)
  const dragOver = ref(-1)

  /** 手柄 pointerdown：武装 draggable，并登记一次性的松开复位。
   *  真正的拖拽不会派发 pointerup（由 dragend 复位），所以这里只覆盖
   *  「按住手柄又松开、没拖」的情况——否则行会一直保持可拖拽。 */
  function arm() {
    armed.value = true
    window.addEventListener('pointerup', disarm, { once: true })
  }

  function disarm() {
    armed.value = false
  }

  function onDragStart(e: DragEvent, index: number) {
    dragFrom.value = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      // Firefox 必须显式 setData 才会启动拖拽
      e.dataTransfer.setData('text/plain', String(index))
    }
  }

  function onDrop() {
    if (dragFrom.value >= 0 && dragOver.value >= 0 && dragFrom.value !== dragOver.value) {
      onReorder(dragFrom.value, dragOver.value)
    }
    resetDrag()
  }

  function resetDrag() {
    armed.value = false
    dragFrom.value = -1
    dragOver.value = -1
  }

  return { armed, arm, dragFrom, dragOver, onDragStart, onDrop, resetDrag }
}
