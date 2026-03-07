import { useEffect, useState, useCallback } from "react";
import {
  Box,
  SimpleGrid,
  Text,
  Flex,
  Button,
  Input,
  HStack,
  VStack,
  IconButton,
  useColorModeValue,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Badge,
} from "@chakra-ui/react";
import {
  MdAdd,
  MdDelete,
  MdEdit,
  MdFolder,
  MdOpenInNew,
} from "react-icons/md";
import { useOutletContext, useNavigate } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import Card from "../components/card/Card";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import { db } from "../lib/db";

export default function Collections() {
  const { onOpenSidebar } = useOutletContext();
  const navigate = useNavigate();
  const toast = useToast();
  const [collections, setCollections] = useState([]);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [activeCollection, setActiveCollection] = useState(null);
  const [collectionBookmarks, setCollectionBookmarks] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");

  const loadCollections = useCallback(async () => {
    const all = await db.collections.toArray();
    const withCounts = await Promise.all(
      all.map(async (c) => {
        const count = await db.collectionItems
          .where("collectionId")
          .equals(c.id)
          .count();
        return { ...c, count };
      })
    );
    setCollections(withCounts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const createCollection = async () => {
    const name = newName.trim();
    if (!name) return;

    const existing = await db.collections.where("name").equals(name).first();
    if (existing) {
      toast({ title: "Collection already exists", status: "warning", duration: 2000, position: "top" });
      return;
    }

    await db.collections.add({ name, createdAt: new Date().toISOString() });
    setNewName("");
    loadCollections();
    toast({ title: `Created "${name}"`, status: "success", duration: 2000, position: "top" });
  };

  const deleteCollection = async (id) => {
    await db.collectionItems.where("collectionId").equals(id).delete();
    await db.collections.delete(id);
    loadCollections();
    if (activeCollection?.id === id) {
      setActiveCollection(null);
      setCollectionBookmarks([]);
    }
    toast({ title: "Collection deleted", status: "info", duration: 2000, position: "top" });
  };

  const renameCollection = async () => {
    const name = editName.trim();
    if (!name || !editId) return;
    await db.collections.update(editId, { name });
    setEditId(null);
    setEditName("");
    loadCollections();
    if (activeCollection?.id === editId) {
      setActiveCollection((prev) => ({ ...prev, name }));
    }
  };

  const viewCollection = async (collection) => {
    setActiveCollection(collection);
    const items = await db.collectionItems
      .where("collectionId")
      .equals(collection.id)
      .toArray();
    const bmIds = items.map((i) => i.bookmarkId);
    const bms = await db.bookmarks.where("id").anyOf(bmIds).toArray();
    setCollectionBookmarks(bms);
    onOpen();
  };

  const removeFromCollection = async (bookmarkId) => {
    await db.collectionItems
      .where("[collectionId+bookmarkId]")
      .equals([activeCollection.id, bookmarkId])
      .delete();
    // Fallback — delete by matching fields
    const items = await db.collectionItems
      .where("collectionId")
      .equals(activeCollection.id)
      .toArray();
    const toRemove = items.filter((i) => i.bookmarkId === bookmarkId);
    if (toRemove.length) {
      await db.collectionItems.bulkDelete(toRemove.map((i) => i.id));
    }
    setCollectionBookmarks((prev) => prev.filter((bm) => bm.id !== bookmarkId));
    loadCollections();
  };

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Collections" />

      {/* Create new */}
      <Card mb="20px">
        <Text fontSize="sm" fontWeight="700" color={textColor} mb="8px">
          Create a new collection
        </Text>
        <HStack>
          <Input
            size="sm"
            placeholder="e.g. AI Research, Startup Ideas"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createCollection()}
            borderRadius="12px"
            maxW="300px"
          />
          <Button
            size="sm"
            leftIcon={<MdAdd />}
            colorScheme="brand"
            variant="solid"
            borderRadius="12px"
            onClick={createCollection}
            isDisabled={!newName.trim()}
          >
            Create
          </Button>
        </HStack>
      </Card>

      {/* Collections grid */}
      {collections.length === 0 ? (
        <Card>
          <Text color={subColor} textAlign="center" py="40px">
            No collections yet. Create one above, then add bookmarks from the
            Bookmarks page.
          </Text>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
          {collections.map((c) => (
            <Card key={c.id}>
              {editId === c.id ? (
                <HStack mb="8px">
                  <Input
                    size="sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && renameCollection()}
                    borderRadius="12px"
                    autoFocus
                  />
                  <Button size="xs" onClick={renameCollection}>
                    Save
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditId(null)}>
                    Cancel
                  </Button>
                </HStack>
              ) : (
                <Flex justify="space-between" align="center">
                  <Flex
                    align="center"
                    gap="10px"
                    cursor="pointer"
                    onClick={() => viewCollection(c)}
                    flex="1"
                  >
                    <MdFolder size={20} color="#2B6CB0" />
                    <Box>
                      <Text fontSize="sm" fontWeight="700" color={textColor}>
                        {c.name}
                      </Text>
                      <Text fontSize="xs" color={subColor}>
                        {c.count} bookmark{c.count !== 1 ? "s" : ""}
                      </Text>
                    </Box>
                  </Flex>
                  <HStack spacing="4px">
                    <IconButton
                      icon={<MdEdit />}
                      size="xs"
                      variant="ghost"
                      color={subColor}
                      aria-label="Rename"
                      onClick={() => {
                        setEditId(c.id);
                        setEditName(c.name);
                      }}
                    />
                    <IconButton
                      icon={<MdDelete />}
                      size="xs"
                      variant="ghost"
                      color="red.400"
                      aria-label="Delete collection"
                      onClick={() => deleteCollection(c.id)}
                    />
                  </HStack>
                </Flex>
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Collection detail modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent bg={useColorModeValue("white", "navy.800")} borderRadius="20px">
          <ModalHeader color={textColor}>
            <Flex align="center" gap="8px">
              <MdFolder color="#2B6CB0" />
              {activeCollection?.name}
              <Badge colorScheme="brand" ml="8px">
                {collectionBookmarks.length}
              </Badge>
            </Flex>
          </ModalHeader>
          <ModalCloseButton color={textColor} />
          <ModalBody>
            {collectionBookmarks.length === 0 ? (
              <Text color={subColor} textAlign="center" py="20px">
                No bookmarks in this collection yet. Add them from the Bookmarks page.
              </Text>
            ) : (
              <VStack spacing="12px" align="stretch">
                {collectionBookmarks.map((bm) => (
                  <Flex key={bm.id} align="flex-start" gap="8px">
                    <Box flex="1">
                      <BookmarkCard bookmark={bm} />
                    </Box>
                    <IconButton
                      icon={<MdDelete />}
                      size="xs"
                      variant="ghost"
                      color="red.400"
                      aria-label="Remove from collection"
                      mt="8px"
                      onClick={() => removeFromCollection(bm.id)}
                    />
                  </Flex>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
