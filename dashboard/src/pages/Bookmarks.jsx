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
  Checkbox,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import {
  MdSearch,
  MdFilterList,
  MdSelectAll,
  MdDeselect,
  MdMoreVert,
  MdDelete,
  MdLabel,
  MdFolder,
} from "react-icons/md";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import Card from "../components/card/Card";
import { db } from "../lib/db";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [allTags, setAllTags] = useState([]);
  const [allAuthors, setAllAuthors] = useState([]);

  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");

  useEffect(() => {
    async function load() {
      const all = await db.bookmarks.toArray();
      setBookmarks(all);

      const tags = new Set();
      const authors = new Set();
      for (const bm of all) {
        if (bm.tags) bm.tags.forEach((t) => tags.add(t));
        if (bm.author_username) authors.add(bm.author_username);
      }
      setAllTags([...tags].sort());
      setAllAuthors([...authors].sort());
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = [...bookmarks];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (bm) =>
          (bm.text || "").toLowerCase().includes(q) ||
          (bm.author_username || "").toLowerCase().includes(q) ||
          (bm.author_name || "").toLowerCase().includes(q)
      );
    }

    // Filter by tag
    if (filterTag) {
      result = result.filter(
        (bm) => bm.tags && bm.tags.includes(filterTag)
      );
    }

    // Filter by author
    if (filterAuthor) {
      result = result.filter(
        (bm) => bm.author_username === filterAuthor
      );
    }

    // Date range filter
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

    // Sort
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
  }, [bookmarks, search, sortBy, filterTag, filterAuthor, dateFrom, dateTo]);

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
    // Refresh
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

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Bookmarks" />

      {/* Filters */}
      <Card mb="20px">
        <Flex gap="12px" wrap="wrap" align="center">
          <InputGroup maxW="300px" size="sm">
            <InputLeftElement>
              <MdSearch color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              borderRadius="12px"
              fontSize="sm"
            />
          </InputGroup>

          <Select
            size="sm"
            maxW="180px"
            borderRadius="12px"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {allTags.length > 0 && (
            <Select
              size="sm"
              maxW="160px"
              borderRadius="12px"
              placeholder="All Tags"
              value={filterTag}
              onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}
            >
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}

          {allAuthors.length > 0 && (
            <Select
              size="sm"
              maxW="180px"
              borderRadius="12px"
              placeholder="All Authors"
              value={filterAuthor}
              onChange={(e) => { setFilterAuthor(e.target.value); setPage(1); }}
            >
              {allAuthors.map((a) => (
                <option key={a} value={a}>
                  @{a}
                </option>
              ))}
            </Select>
          )}

          <Input
            type="date"
            size="sm"
            maxW="150px"
            borderRadius="12px"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            placeholder="From"
            title="From date"
          />
          <Input
            type="date"
            size="sm"
            maxW="150px"
            borderRadius="12px"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            placeholder="To"
            title="To date"
          />
        </Flex>

        {/* Active filters */}
        {(filterTag || filterAuthor || search || dateFrom || dateTo) && (
          <HStack mt="10px" spacing="6px" wrap="wrap">
            {search && (
              <Tag size="sm" borderRadius="full" colorScheme="blue">
                <TagLabel>"{search}"</TagLabel>
                <TagCloseButton onClick={() => setSearch("")} />
              </Tag>
            )}
            {filterTag && (
              <Tag size="sm" borderRadius="full" colorScheme="purple">
                <TagLabel>{filterTag}</TagLabel>
                <TagCloseButton onClick={() => setFilterTag("")} />
              </Tag>
            )}
            {filterAuthor && (
              <Tag size="sm" borderRadius="full" colorScheme="green">
                <TagLabel>@{filterAuthor}</TagLabel>
                <TagCloseButton onClick={() => setFilterAuthor("")} />
              </Tag>
            )}
            {dateFrom && (
              <Tag size="sm" borderRadius="full" colorScheme="orange">
                <TagLabel>From: {dateFrom}</TagLabel>
                <TagCloseButton onClick={() => setDateFrom("")} />
              </Tag>
            )}
            {dateTo && (
              <Tag size="sm" borderRadius="full" colorScheme="orange">
                <TagLabel>To: {dateTo}</TagLabel>
                <TagCloseButton onClick={() => setDateTo("")} />
              </Tag>
            )}
          </HStack>
        )}
      </Card>

      {/* Selection bar */}
      {selected.size > 0 && (
        <Card mb="16px" p="12px 20px">
          <Flex align="center" justify="space-between">
            <Text fontSize="sm" fontWeight="600" color={textColor}>
              {selected.size} selected
            </Text>
            <HStack spacing="8px">
              <Button size="xs" variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
              <Button
                size="xs"
                colorScheme="brand"
                variant="outline"
                onClick={exportSelected}
              >
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

      {/* Results count */}
      <Flex justify="space-between" align="center" mb="12px" px="4px">
        <Text fontSize="sm" color={subColor}>
          {filtered.length} bookmark{filtered.length !== 1 ? "s" : ""}
        </Text>
        <HStack>
          <Button
            size="xs"
            leftIcon={<MdSelectAll />}
            variant="ghost"
            onClick={selectAll}
            color={subColor}
          >
            Select All
          </Button>
        </HStack>
      </Flex>

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
          <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
            {paged.map((bm) => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                isSelected={selected.has(bm.id)}
                onSelect={toggleSelect}
                onTagClick={(tag) => { setFilterTag(tag); setPage(1); }}
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
