import EditGlobals from './EditGlobals.js';
import U from '../../Core/Utilities.js';
import MenuItem from './Menu/MenuItem.js';
import Menu from './Menu/Menu.js';
import EditMode from './EditMode.js';

const {
    addEvent,
    merge
} = U;

class EditContextMenu extends Menu {
    /* *
    *
    *  Static Properties
    *
    * */
    protected static readonly defaultOptions: EditContextMenu.Options = {
        enabled: true,
        className: EditGlobals.classNames.contextMenu,
        contextMenuIcon: 'https://code.highcharts.com/@product.version@/gfx/dashboard-icons/menu.svg',
        items: ['saveLocal', 'verticalSeparator', 'editMode']
    }

    public static items: Record<string, MenuItem.Options> =
    merge(Menu.items, {
        editMode: {
            type: 'editMode',
            className: EditGlobals.classNames.contextMenuItem,
            text: 'Edit mode',
            events: {
                click: function (this: MenuItem, e: any): void {
                    (this.menu as EditContextMenu).editMode.onEditModeToggle(e.target);
                }
            }
        },
        saveLocal: {
            type: 'saveLocal',
            className: EditGlobals.classNames.contextMenuItem,
            text: 'Save locally',
            events: {
                click: function (): void {}
            }
        }
    })

    /* *
    *
    *  Constructor
    *
    * */
    constructor(
        editMode: EditMode,
        options?: EditContextMenu.Options|undefined
    ) {
        super(
            editMode.dashboard.container,
            merge(EditContextMenu.defaultOptions, options || {})
        );

        this.editMode = editMode;

        super.initItems(EditContextMenu.items);

        if (this.options.items) {
            const items: Array<string> = [];

            for (let i = 0, iEnd = this.options.items.length; i < iEnd; ++i) {
                if (typeof this.options.items[i] === 'string') {
                    items.push(this.options.items[i] as string);
                } else if ((this.options.items[i] as MenuItem.Options).type) {
                    items.push((this.options.items[i] as MenuItem.Options).type);
                }
            }

            this.updateActiveItems(items);
        }

        addEvent(document, 'click', (event): void => {
            if (
                event.target !== this.container &&
                event.target !== editMode.contextButtonElement &&
                this.isVisible
            ) {
                this.setVisible(false);
            }
        });
    }

    /* *
    *
    *  Properties
    *
    * */
    public editMode: EditMode;

    /* *
    *
    *  Functions
    *
    * */
    public setVisible(visible: boolean): void {
        const contextMenu = this;

        if (
            contextMenu.container
        ) {
            if (visible) {
                contextMenu.container.style.display = 'block';
                contextMenu.isVisible = true;
            } else {
                contextMenu.container.style.display = 'none';
                contextMenu.isVisible = false;
            }
        }
    }
}

namespace EditContextMenu {
    export interface Options extends Menu.Options {
        enabled?: true;
        contextMenuIcon?: string;
    }
}

export default EditContextMenu;