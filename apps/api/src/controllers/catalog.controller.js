import { catalogCategoriesRepo } from "../repos/catalogCategories.repo.js";
import { catalogItemsRepo } from "../repos/catalogItems.repo.js";

export function catalogController(db) {
    const categories = catalogCategoriesRepo(db);
    const items = catalogItemsRepo(db);

    return {
        async listCategories(_req, res) {
            const rows = await categories.list();
            res.json({ categories: rows });
        },

        async listItems(req, res) {
            const categoryId =
                typeof req.query.categoryId === "string" && req.query.categoryId.trim()
                    ? req.query.categoryId.trim()
                    : null;

            const kind =
                typeof req.query.kind === "string" && req.query.kind.trim()
                    ? req.query.kind.trim()
                    : null;

            // if kind is provided, filter by kind; else categoryId filter
            let rows;
            if (kind) rows = await items.listByKind(kind);
            else rows = await items.list({ categoryId });

            res.json({ items: rows });
        }
    };
}
