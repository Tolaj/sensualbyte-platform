import { catalogCategoriesRepo } from "../repos/catalogCategories.repo.js";
import { catalogItemsRepo } from "../repos/catalogItems.repo.js";

export function catalogController(db) {
    const categories = catalogCategoriesRepo(db);
    const items = catalogItemsRepo(db);

    return {
        async listCategories(req, res) {
            const rows = await categories.list();
            res.json({ categories: rows });
        },

        async listItems(req, res) {
            const categoryId = req.query.categoryId || null;
            const rows = await items.list({ categoryId });
            res.json({ items: rows });
        }
    };
}
