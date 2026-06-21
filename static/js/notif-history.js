(function () {

    const KEY = "imtsb_notifications";

    const MAX_ITEMS = 50;

    function getAll() {

        try {

            const lista =
                JSON.parse(
                    localStorage.getItem(KEY) || "[]"
                );

            return Array.isArray(lista)
                ? lista
                : [];

        } catch (_) {

            return [];

        }

    }

    function save(lista) {

        try {

            localStorage.setItem(
                KEY,
                JSON.stringify(
                    lista.slice(0, MAX_ITEMS)
                )
            );

        } catch (_) {

        }

    }

    function push(tipo, mensagem) {

        const lista = getAll();

        const ultima = lista[0];

        if (
            ultima &&
            ultima.tipo === tipo &&
            ultima.mensagem === mensagem
        ) {

            const ts =
                Date.parse(
                    ultima.timestamp || ""
                );

            if (
                !isNaN(ts) &&
                (Date.now() - ts) < 3000
            ) {
                return;
            }

        }

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

    document.addEventListener("DOMContentLoaded", () => {

        render();

        const btn = document.getElementById("nhClearBtn");

        if (btn) {
            btn.addEventListener("click", clear);
        }

    });

})();