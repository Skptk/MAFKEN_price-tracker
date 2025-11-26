export interface PricePoint {
    price: number;
    date: string;
}

export interface Project {
    id: string;
    name: string;
    category: string;
    createdAt: string;
    color?: string;
}

export interface TrackedItem {
    id: string;
    sku: string;
    name: string;
    link: string;
    retailPrice: number;
    originalPrice?: number;
    currentPrice: number | null;
    imageUrl?: string;
    priceHistory: PricePoint[];
    lastUpdated: string | null;
    alertTriggered: boolean;
    projectId?: string;
    status?: 'active' | 'deleted';
    dateAdded?: string;
    offerStartDate?: string;
    offerEndDate?: string;
    lastOfferDuration?: number;
}

export interface AlertMessage {
    id: number;
    sku: string;
    name: string;
    message: string;
    time: string;
    type: 'success' | 'alert' | 'update' | 'error';
}

export interface AppState {
    trackedItems: TrackedItem[];
    projects: Project[];
    deletedItemsCount: number;
}
