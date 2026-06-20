(function () {

    const KEY = "imtsb_notifications";

    function getAll() {
        return JSON.parse(
            localStorage.getItem(KEY) || "[]"
        );
    }

    function save(lista) {
        localStorage.setItem(
            KEY,
            JSON.stringify(lista)
        );
    }

    function push(tipo, mensagem) {

        const lista = getAll();

        lista.unshift({
            tipo,
            mensagem,
            timestamp: new Date().toISOString()
        });

        save(lista);

        render();
    }

    function clear() {
        localStorage.removeItem(KEY);
        render();
    }

    function render() {

        const list  = document.getElementById("nhList");
        const badge = document.getElementById("nhBadge");

        if (!list || !badge) return;

        const notificacoes = getAll();

        badge.textContent = notificacoes.length;

        if (!notificacoes.length) {

            list.innerHTML = `
                <li class="nh-empty">
                    Sem notificações.
                </li>
            `;

            return;
        }

        list.innerHTML = notificacoes.map(n => `
            <li class="nh-item">
                ✓ ${n.mensagem}
            </li>
        `).join("");
    }

    window.NH = {
        push,
        render,
        clear
    };

    document.addEventListener(
        "DOMContentLoaded",
        render
    );

})();