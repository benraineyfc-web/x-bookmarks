import { useEffect, useState } from "react";
import {
  Box,
  SimpleGrid,
  Text,
  Flex,
  Tag,
  TagLabel,
  Button,
  Input,
  HStack,
  useColorModeValue,
  IconButton,
} from "@chakra-ui/react";
import { MdDelete, MdAdd } from "react-icons/md";
import { useOutletContext, useNavigate } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import Card from "../components/card/Card";
import { db } from "../lib/db";

export default function Tags() {
  const { onOpenSidebar } = useOutletContext();
  const navigate = useNavigate();
  const [tagCounts, setTagCounts] = useState([]);
  const [newTag, setNewTag] = useState("");
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const brandColor = useColorModeValue("brand.500", "brand.400");

  const loadTags = async () => {
    const all = await db.bookmarks.toArray();
    const counts = new Map();
    for (const bm of all) {
      if (bm.tags) {
        for (const t of bm.tags) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
    }
    setTagCounts(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }))
    );
  };

  useEffect(() => {
    loadTags();
  }, []);

  const removeTag = async (tagName) => {
    const all = await db.bookmarks.where("tags").equals(tagName).toArray();
    await db.transaction("rw", db.bookmarks, async () => {
      for (const bm of all) {
        await db.bookmarks.update(bm.id, {
          tags: (bm.tags || []).filter((t) => t !== tagName),
        });
      }
    });
    loadTags();
  };

  const renameTag = async (oldName, newName) => {
    if (!newName || oldName === newName) return;
    const all = await db.bookmarks.where("tags").equals(oldName).toArray();
    await db.transaction("rw", db.bookmarks, async () => {
      for (const bm of all) {
        const tags = (bm.tags || []).map((t) => (t === oldName ? newName : t));
        await db.bookmarks.update(bm.id, { tags: [...new Set(tags)] });
      }
    });
    loadTags();
  };

  return (
    <Box>
      <Navbar onOpen={onOpenSidebar} title="Tags" />

      <Card mb="20px">
        <Text fontSize="sm" color={subColor} mb="4px">
          Tags are applied during import or from the Bookmarks page. Here you
          can manage and browse them.
        </Text>
      </Card>

      {tagCounts.length === 0 ? (
        <Card>
          <Text color={subColor} textAlign="center" py="40px">
            No tags yet. Add tags when importing bookmarks or from the Bookmarks
            page.
          </Text>
        </Card>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="16px">
          {tagCounts.map(({ name, count }) => (
            <Card key={name}>
              <Flex justify="space-between" align="center">
                <Flex align="center" gap="10px">
                  <Tag
                    size="lg"
                    borderRadius="full"
                    colorScheme="brand"
                    cursor="pointer"
                    onClick={() =>
                      navigate(`/bookmarks?tag=${encodeURIComponent(name)}`)
                    }
                  >
                    <TagLabel>{name}</TagLabel>
                  </Tag>
                  <Text fontSize="sm" fontWeight="600" color={textColor}>
                    {count} bookmark{count !== 1 ? "s" : ""}
                  </Text>
                </Flex>
                <HStack>
                  <IconButton
                    icon={<MdDelete />}
                    size="xs"
                    variant="ghost"
                    color="red.400"
                    aria-label="Delete tag"
                    onClick={() => removeTag(name)}
                  />
                </HStack>
              </Flex>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
