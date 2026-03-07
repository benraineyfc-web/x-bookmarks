import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  SimpleGrid,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  HStack,
  Flex,
  Text,
  Tag,
  TagLabel,
  TagCloseButton,
  Button,
  useColorModeValue,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Kbd,
} from "@chakra-ui/react";
import {
  MdSearch,
  MdSelectAll,
  MdMoreVert,
  MdDelete,
  MdLabel,
  MdFolder,
  MdStarBorder,
  MdStar,
  MdViewModule,
  MdViewList,
  MdFilterList,
  MdSort,
} from "react-icons/md";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import Card from "../components/card/Card";
import { db } from "../lib/db";
import { CATEGORIES, getCategoryColor } from "../lib/categorize";

const SORT_OPTIONS = [
  { value: "importedAt-desc", label: "Recently Added" },
  { value: "created_at-desc", label: "Newest First" },
  { value: "created_at-asc", label: "Oldest First" },
  { value: "likes-desc", label: "Most Liked" },
  { value: "retweets-desc", label: "Most Retweeted" },
  { value: "views-desc", label: "Most Viewed" },
];

const PAGE_SIZE = 30;

export default function Bookmarks() {
  const { onOpenSidebar } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookmarks, setBookmarks] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState("importedAt-desc");
  const [filterTag, setFilterTag] = useState(searchParams.get("tag") || "");
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterCategory, setFilterCategory] = useState(searchParams.get("category") || "");
  const [filterFavorites, setFilterFavorites] = useState(searchParams.get("favorites") === "true");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [allTags, setAllTags] = useState([]);
  const [allAuthors, setAllAuthors] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [showFilters, setShowFilters] = useState(false);

  const textColor = useColorModeValue("gray.800", "white");
  const subColor = useColorModeValue("gray.500", "gray.400");
  const brandColor = useColorModeValue("brand.500", "brand.400");
  const filterBg = useColorModeValue("white", "navy.800");
  const inputBg = useColorModeValue("gray.50", "navy.800");

  // Read search params on mount and when they change
  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setFilterTag(searchParams.get("tag") || "");
    setFilterCategory(searchParams.get("category") || "");
    setFilterFavorites(searchParams.get("favorites") === "true");
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      const all = await db.bookmarks.toArray();
      setBookmarks(all);

      const tags = new Set();
      const authors = new Set();
      const categories = new Set();
      for (const bm of all) {
        if (bm.tags) bm.tags.forEach((t) => tags.add(t));
        if (bm.author_username) authors.add(bm.author_username);
        if (bm.categories) bm.categories.forEach((c) => categories.add(c));
      }
      setAllTags([...tags].sort());
      setAllAuthors([...authors].sort());
      setAllCategories([...categories].sort());
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = [...bookmarks];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (bm) =>
          (bm.text || "").toLowerCase().includes(q) ||
          (bm.author_username || "").toLowerCase().includes(q) ||
          (bm.author_name || "").toLowerCase().includes(q)
      );
    }

    if (filterTag) {
      result = result.filter((bm) => bm.tags && bm.tags.includes(filterTag));
    }

    if (filterAuthor) {
      result = result.filter((bm) => bm.author_username === filterAuthor);
    }

    if (filterCategory) {
      if (filterCategory === "unsorted") {
        result = result.filter((bm) => !bm.categories || bm.categories.length === 0);
      } else {
        result = result.filter((bm) => bm.categories && bm.categories.includes(filterCategory));
      }
    }

    if (filterFavorites) {
      result = result.filter((bm) => bm.favorite);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((bm) => {
        const d = new Date(bm.created_at || bm.importedAt || 0);
        return d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((bm) => {
        const d = new Date(bm.created_at || bm.importedAt || 0);
        return d <= to;
      });
    }

    const [field, dir] = sortBy.split("-");
    result.sort((a, b) => {
      let va = a[field] || 0;
      let vb = b[field] || 0;
      if (typeof va === "string") {
        va = va.toLowerCase();
        vb = (vb || "").toLowerCase();
      }
      if (dir === "desc") return va > vb ? -1 : va < vb ? 1 : 0;
      return va < vb ? -1 : va > vb ? 1 : 0;
    });

    return result;
  }, [bookmarks, search, sortBy, filterTag, filterAuthor, filterCategory, filterFavorites, dateFrom, dateTo]);

  const paged = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  );

  const toggleSelect = useCallback((bm) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bm.id)) next.delete(bm.id);
      else next.add(bm.id);
      return next;
    });
  }, []);

  const selectAll = () => {
    setSelected(new Set(filtered.map((bm) => bm.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const deleteSelected = async () => {
    if (!selected.size) return;
    await db.bookmarks.bulkDelete([...selected]);
    setBookmarks((prev) => prev.filter((bm) => !selected.has(bm.id)));
    setSelected(new Set());
  };

  const handleDelete = (id) => {
    setBookmarks((prev) => prev.filter((bm) => bm.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleFavoriteToggle = (id, val) => {
    setBookmarks((prev) =>
      prev.map((bm) => (bm.id === id ? { ...bm, favorite: val } : bm))
    );
  };

  const exportSelected = () => {
    const ids = [...selected];
    navigate("/export", { state: { selectedIds: ids } });
  };

  const addTagToSelected = async (tag) => {
    const ids = [...selected];
    await db.transaction("rw", db.bookmarks, async () => {
      for (const id of ids) {
        const bm = await db.bookmarks.get(id);
        if (bm) {
          const tags = new Set(bm.tags || []);
          tags.add(tag);
          await db.bookmarks.update(id, { tags: [...tags] });
        }
      }
    });
    const all = await db.bookmarks.toArray();
    setBookmarks(all);
  };

  const addToCollection = async () => {
    const collections = await db.collections.toArray();
    if (collections.length === 0) {
      const name = prompt("No collections yet. Enter a name to create one:");
      if (!name?.trim()) return;
      const id = await db.collections.add({ name: name.trim(), createdAt: new Date().toISOString() });
      for (const bmId of selected) {
        await db.collectionItems.add({ collectionId: id, bookmarkId: bmId });
      }
    } else {
      const list = collections.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
      const choice = prompt(`Choose a collection (enter number):\n${list}\n\nOr type a new name to create one:`);
      if (!choice?.trim()) return;
      const num = parseInt(choice);
      let collId;
      if (num >= 1 && num <= collections.length) {
        collId = collections[num - 1].id;
      } else {
        collId = await db.collections.add({ name: choice.trim(), createdAt: new Date().toISOString() });
      }
      for (const bmId of selected) {
        const exists = await db.collectionItems
          .where("collectionId").equals(collId)
          .filter((i) => i.bookmarkId === bmId)
          .first();
        if (!exists) {
          await db.collectionItems.add({ collectionId: collId, bookmarkId: bmId });
        }
      }
    }
    setSelected(new Set());
  };

  const hasActiveFilters = filterTag || filterAuthor || filterCategory || filterFavorites || search || dateFrom || dateTo;

  // Determine heading
  let heading = "All Bookmarks";
  if (filterCategory === "unsorted") heading = "Unsorted";
  else if (filterCategory) heading = filterCategory;
  else if (filterFavorites) heading = "Favorites";
  else if (filterTag) heading = `#${filterTag}`;
  else if (filterAuthor) heading = `@${filterAuthor}`;

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="" />

      {/* Top bar - Dewey style */}
      <Flex
        align="center"
        justify="space-between"
        mb="20px"
        flexWrap="wrap"
        gap="12px"
      >
        <Flex align="center" gap="12px">
          <Text fontSize="xl" fontWeight="700" color={textColor}>
            {heading}
          </Text>
          <Text fontSize="sm" color={subColor}>
            {filtered.length} bookmark{filtered.length !== 1 ? "s" : ""}
          </Text>
        </Flex>

        <HStack spacing="8px">
          {/* Search */}
          <InputGroup size="sm" maxW="240px">
            <InputLeftElement>
              <MdSearch color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              borderRadius="10px"
              fontSize="sm"
              bg={inputBg}
              border="none"
            />
          </InputGroup>

          {/* Sort dropdown */}
          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              variant="ghost"
              leftIcon={<MdSort />}
              fontWeight="500"
              color={subColor}
            >
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"}
            </MenuButton>
            <MenuList>
              {SORT_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  fontWeight={sortBy === opt.value ? "600" : "400"}
                >
                  {opt.label}
                </MenuItem>
              ))}
            </MenuList>
          </Menu>

          {/* Filter toggle */}
          <Button
            size="sm"
            variant={showFilters ? "solid" : "ghost"}
            colorScheme={showFilters ? "brand" : "gray"}
            leftIcon={<MdFilterList />}
            onClick={() => setShowFilters(!showFilters)}
            fontWeight="500"
          >
            Filters
          </Button>

          {/* View mode */}
          <HStack spacing="2px">
            <IconButton
              icon={<MdViewModule />}
              size="sm"
              variant={viewMode === "grid" ? "solid" : "ghost"}
              colorScheme={viewMode === "grid" ? "brand" : "gray"}
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
            />
            <IconButton
              icon={<MdViewList />}
              size="sm"
              variant={viewMode === "list" ? "solid" : "ghost"}
              colorScheme={viewMode === "list" ? "brand" : "gray"}
              aria-label="List view"
              onClick={() => setViewMode("list")}
            />
          </HStack>

          {/* Select all */}
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<MdSelectAll />}
            onClick={selectAll}
            color={subColor}
            fontWeight="500"
          >
            Select All
          </Button>
        </HStack>
      </Flex>

      {/* Expandable filter panel */}
      {showFilters && (
        <Card mb="16px" p="14px 18px">
          <Flex gap="10px" wrap="wrap" align="center">
            {allCategories.length > 0 && (
              <Select
                size="sm"
                maxW="180px"
                borderRadius="10px"
                placeholder="All Categories"
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                bg={inputBg}
                border="none"
              >
                <option value="unsorted">Unsorted</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            )}

            {allTags.length > 0 && (
              <Select
                size="sm"
                maxW="160px"
                borderRadius="10px"
                placeholder="All Tags"
                value={filterTag}
                onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}
                bg={inputBg}
                border="none"
              >
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            )}

            {allAuthors.length > 0 && (
              <Select
                size="sm"
                maxW="180px"
                borderRadius="10px"
                placeholder="All Authors"
                value={filterAuthor}
                onChange={(e) => { setFilterAuthor(e.target.value); setPage(1); }}
                bg={inputBg}
                border="none"
              >
                {allAuthors.map((a) => (
                  <option key={a} value={a}>@{a}</option>
                ))}
              </Select>
            )}

            <Button
              size="sm"
              variant={filterFavorites ? "solid" : "outline"}
              colorScheme={filterFavorites ? "orange" : "gray"}
              borderRadius="10px"
              leftIcon={filterFavorites ? <MdStar /> : <MdStarBorder />}
              onClick={() => { setFilterFavorites(!filterFavorites); setPage(1); }}
            >
              Favorites
            </Button>

            <Input
              type="date"
              size="sm"
              maxW="145px"
              borderRadius="10px"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              placeholder="From"
              title="From date"
              bg={inputBg}
              border="none"
            />
            <Input
              type="date"
              size="sm"
              maxW="145px"
              borderRadius="10px"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              placeholder="To"
              title="To date"
              bg={inputBg}
              border="none"
            />
          </Flex>
        </Card>
      )}

      {/* Active filter pills */}
      {hasActiveFilters && (
        <HStack mb="16px" spacing="6px" wrap="wrap">
          {search && (
            <Tag size="sm" borderRadius="full" colorScheme="blue" variant="subtle">
              <TagLabel>"{search}"</TagLabel>
              <TagCloseButton onClick={() => setSearch("")} />
            </Tag>
          )}
          {filterCategory && (
            <Tag size="sm" borderRadius="full" colorScheme={filterCategory === "unsorted" ? "gray" : getCategoryColor(filterCategory)} variant="subtle">
              <TagLabel>{filterCategory === "unsorted" ? "Unsorted" : filterCategory}</TagLabel>
              <TagCloseButton onClick={() => setFilterCategory("")} />
            </Tag>
          )}
          {filterTag && (
            <Tag size="sm" borderRadius="full" colorScheme="purple" variant="subtle">
              <TagLabel>#{filterTag}</TagLabel>
              <TagCloseButton onClick={() => setFilterTag("")} />
            </Tag>
          )}
          {filterAuthor && (
            <Tag size="sm" borderRadius="full" colorScheme="green" variant="subtle">
              <TagLabel>@{filterAuthor}</TagLabel>
              <TagCloseButton onClick={() => setFilterAuthor("")} />
            </Tag>
          )}
          {filterFavorites && (
            <Tag size="sm" borderRadius="full" colorScheme="orange" variant="subtle">
              <TagLabel>Favorites</TagLabel>
              <TagCloseButton onClick={() => setFilterFavorites(false)} />
            </Tag>
          )}
          {(dateFrom || dateTo) && (
            <Tag size="sm" borderRadius="full" colorScheme="cyan" variant="subtle">
              <TagLabel>{dateFrom || "..."} - {dateTo || "..."}</TagLabel>
              <TagCloseButton onClick={() => { setDateFrom(""); setDateTo(""); }} />
            </Tag>
          )}
        </HStack>
      )}

      {/* Selection bar */}
      {selected.size > 0 && (
        <Card mb="16px" p="10px 16px" bg={useColorModeValue("blue.50", "navy.700")}>
          <Flex align="center" justify="space-between">
            <Text fontSize="sm" fontWeight="600" color={textColor}>
              {selected.size} selected
            </Text>
            <HStack spacing="6px">
              <Button size="xs" variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
              <Button size="xs" colorScheme="brand" onClick={exportSelected}>
                Export to Claude
              </Button>
              <Menu>
                <MenuButton as={IconButton} icon={<MdMoreVert />} size="xs" variant="ghost" />
                <MenuList>
                  <MenuItem icon={<MdLabel />} onClick={() => {
                    const tag = prompt("Enter tag name:");
                    if (tag) addTagToSelected(tag.trim());
                  }}>
                    Add Tag
                  </MenuItem>
                  <MenuItem icon={<MdFolder />} onClick={addToCollection}>
                    Add to Collection
                  </MenuItem>
                  <MenuItem icon={<MdDelete />} color="red.400" onClick={deleteSelected}>
                    Delete Selected
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          </Flex>
        </Card>
      )}

      {/* Bookmark grid */}
      {filtered.length === 0 ? (
        <Card>
          <Text color={subColor} textAlign="center" py="40px">
            {bookmarks.length === 0
              ? "No bookmarks yet. Import some first!"
              : "No bookmarks match your filters."}
          </Text>
        </Card>
      ) : (
        <>
          <SimpleGrid
            columns={viewMode === "list" ? { base: 1 } : { base: 1, md: 2, xl: 3 }}
            gap="16px"
          >
            {paged.map((bm) => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                isSelected={selected.has(bm.id)}
                onSelect={toggleSelect}
                onTagClick={(tag) => { setFilterTag(tag); setPage(1); }}
                onDelete={handleDelete}
                onFavoriteToggle={handleFavoriteToggle}
              />
            ))}
          </SimpleGrid>

          {paged.length < filtered.length && (
            <Flex justify="center" mt="24px">
              <Button
                variant="outline"
                borderRadius="16px"
                onClick={() => setPage((p) => p + 1)}
                color={brandColor}
                borderColor={brandColor}
                size="sm"
              >
                Load More ({filtered.length - paged.length} remaining)
              </Button>
            </Flex>
          )}
        </>
      )}
    </Box>
  );
}
