import { useStoreSelector } from '../../../src/index'
import store, { updateSearchQuery } from '../store'

export default function Search() {
    const { searchResults, isSearching } = useStoreSelector(store, ['searchResults', 'isSearching'])

    return (
        <section className="section">
            <h3>🔍 Debounced Search</h3>
            <div className="search-form">
                <input
                    type="text"
                    placeholder="Search technologies..."
                    onChange={(e) => updateSearchQuery(e.target.value)}
                />
                {isSearching && <span className="searching">Searching...</span>}
            </div>
            <div className="search-results">
                {searchResults.length > 0 ? (
                    <div>
                        <p>{searchResults.length} results:</p>
                        <ul>
                            {searchResults.map((result: string) => (
                                <li key={result}>{result}</li>
                            ))}
                        </ul>
                    </div>

                ) : (
                    <p>Type to search technologies...</p>
                )}
            </div>
            <p className="help-text">
                Search is debounced by 300ms - watch the logs!
            </p>
        </section>
    )
} 