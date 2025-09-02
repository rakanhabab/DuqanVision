# Refactored RAG System

## 📁 Folder Structure

```
refactored_rag_system/
├── config.py                    # All configurations and responses
├── db_service.py               # Database interactions
├── smart_service.py            # Smart responses and formatting
├── rag_service.py              # RAG and memory management
├── rag_system_refactored.py    # Main orchestration
├── sample_products.csv         # Sample product data
└── README.md                   # This file
```

## 🆕 New Products Added

### Recently Added Products:

| SKU | English Name | Arabic Name | Price | Category | Calories |
|-----|--------------|-------------|-------|----------|----------|
| SKU014 | Lays_chips | شيبس ليز | 2.00 ر.س | Snacks | 132 |
| SKU015 | pringles_barbeque | برينجلز باربكيو | 12.00 ر.س | Snacks | 129 |

### Translation Updates:
- `Lays_chips` → `شيبس ليز`
- `pringles_barbeque` → `برينجلز باربكيو`

### New Smart Queries:
- **Chips/Snacks Prices**: `كم سعر الشيبس`, `سعر المقرمشات`, `price of chips`
- **Product Info**: Users can now ask about "شيبس ليز" or "برينجلز باربكيو"

## 🚀 Key Features

### 1. Configuration-Based Responses
All smart responses are now centralized in `config.py`:
```python
SMART_RESPONSES = {
    ("اهلا", "أهلا", "مرحبا", "hello", "hi"): 
        lambda user: f"أهلاً {user}!" if user else "أهلاً وسهلاً!",
    # ... more responses
}
```

### 2. Modular Design
- **DatabaseService**: Handles all Supabase operations
- **SmartResponseService**: Manages responses and formatting
- **RAGService**: Handles LangChain and memory
- **Main System**: Orchestrates all services

### 3. Per-User Memory
Each user gets their own conversation memory:
```python
self.memories = defaultdict(lambda: ConversationBufferMemory(...))
```

### 4. Easy Product Management
Adding new products is simple:
1. Add to `PRODUCT_TRANSLATIONS` in `config.py`
2. Add to `PRODUCT_KEYWORDS` in `config.py`
3. Add to database via `sample_products.csv`

## 📊 Product Categories

| Category | Products | Arabic Keywords |
|----------|----------|-----------------|
| **Beverages** | عصير المراعي, عصير الربيع, صن توب | عصير, مشروب |
| **Dairy** | حليب نادك | حليب |
| **Chocolate** | بارني, جالكسي, كيت كات | شوكولاتة |
| **Cookies** | لويكر, أوريو | بسكويت |
| **Candy** | سكيتلز أخضر, سكيتلز وردي | حلوى |
| **Snacks** | شيبس ليز, برينجلز باربكيو | شيبس, مقرمشات |
| **Health** | بروتين بار | بروتين |

## 🔧 Usage Examples

### Smart Queries:
- `كم سعر الشيبس؟` → Shows chips prices
- `معلومات شيبس ليز` → Product information
- `أعلى سعر` → Highest price product
- `أقل سعر` → Lowest price product

### Database Queries:
- `المنتجات` → List all products
- `الاسعار` → Show all prices
- `الفروع` → Show branches
- `فواتيري` → User's invoices

## 🎯 Benefits of Refactoring

1. **Maintainability**: Easy to add new responses and products
2. **Testability**: Each service can be tested independently
3. **Extensibility**: Simple to add new features
4. **Readability**: Clear separation of concerns
5. **Scalability**: Per-user memory management

## 📝 Adding New Products

To add a new product:

1. **Update translations** in `config.py`:
```python
PRODUCT_TRANSLATIONS = {
    'new_product': 'المنتج الجديد',
    # ... existing translations
}
```

2. **Add to keywords** in `config.py`:
```python
PRODUCT_KEYWORDS = [
    # ... existing keywords
    "المنتج الجديد"
]
```

3. **Add to database** via `sample_products.csv`:
```csv
SKU016,new_product,5.00,Aisle 4 - Shelf 1,Category,150,المنتج الجديد
```

4. **Add smart queries** if needed in `config.py`:
```python
SMART_PRODUCT_QUERIES = {
    ("كم سعر المنتج الجديد", "price of new product"): "new_product_prices",
}
```

The system will automatically handle the new product in all queries! 🎉
