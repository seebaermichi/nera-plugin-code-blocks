// @nera-static/plugin-code-blocks — copy buttons.
//
// Each button is rendered `hidden` at build time and only shown where copying
// can work (navigator.clipboard exists only in secure contexts). Both labels
// come from the build: the button text, and `data-done` for "copied".
;(function () {
    if (!navigator.clipboard) return

    const init = () => {
        document.querySelectorAll('[data-nera-code-copy]').forEach((button) => {
            const block = button.closest('.nera-code')
            const code = block && block.querySelector('code')
            if (!code || button.dataset.neraCodeReady !== undefined) return

            const label = button.textContent
            let timer
            button.dataset.neraCodeReady = ''
            button.hidden = false
            button.addEventListener('click', () => {
                navigator.clipboard.writeText(code.textContent).then(
                    () => {
                        button.textContent = button.dataset.done || label
                        clearTimeout(timer)
                        timer = setTimeout(() => (button.textContent = label), 2000)
                    },
                    () => {}
                )
            })
        })
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
    } else {
        init()
    }
})()
