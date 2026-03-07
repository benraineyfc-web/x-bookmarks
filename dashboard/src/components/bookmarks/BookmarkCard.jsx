import { useState } from "react";
import {
  Box,
  Flex,
  Text,
  Tag,
  TagLabel,
  HStack,
  IconButton,
  useColorModeValue,
  Tooltip,
  Link,
  Collapse,
  Textarea,
  Button,
} from "@chakra-ui/react";
import {
  MdOpenInNew,
  MdFavorite,
  MdRepeat,
  MdVisibility,
  MdExpandMore,
  MdExpandLess,
  MdSave,
} from "react-icons/md";
import Card from "../card/Card";
import { db } from "../../lib/db";

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function BookmarkCard({ bookmark, onSelect, isSelected, onTagClick }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(bookmark.notes || "");
  const [savedNotes, setSavedNotes] = useState(bookmark.notes || "");

  const textColor = useColorModeValue("secondaryGray.900", "white");
  const subColor = useColorModeValue("secondaryGray.600", "secondaryGray.600");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.100");
  const selectedBorder = useColorModeValue("brand.500", "brand.400");
  const codeBg = useColorModeValue("gray.50", "navy.900");

  const hasScraped = bookmark.scraped_json && Object.keys(bookmark.scraped_json).length > 0;
  const notesChanged = notes !== savedNotes;

  const saveNotes = async (e) => {
    e.stopPropagation();
    await db.bookmarks.update(bookmark.id, { notes });
    setSavedNotes(notes);
  };

  const toggleExpand = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <Card
      border="2px solid"
      borderColor={isSelected ? selectedBorder : "transparent"}
      cursor="pointer"
      onClick={() => onSelect && onSelect(bookmark)}
      _hover={{
        borderColor: isSelected ? selectedBorder : borderColor,
        transform: "translateY(-1px)",
      }}
      transition="all 0.15s"
    >
      <Flex justify="space-between" align="flex-start" mb="8px">
        <Box>
          <Text fontSize="sm" fontWeight="700" color={textColor}>
            @{bookmark.author_username}
          </Text>
          {bookmark.author_name && (
            <Text fontSize="xs" color={subColor}>
              {bookmark.author_name}
            </Text>
          )}
        </Box>
        <Flex gap="4px" align="center">
          <Text fontSize="xs" color={subColor}>
            {formatDate(bookmark.created_at)}
          </Text>
          <Tooltip label="Open on X">
            <IconButton
              as={Link}
              href={bookmark.url}
              isExternal
              icon={<MdOpenInNew />}
              size="xs"
              variant="ghost"
              color={subColor}
              aria-label="Open on X"
              onClick={(e) => e.stopPropagation()}
            />
          </Tooltip>
        </Flex>
      </Flex>

      <Text
        fontSize="sm"
        color={textColor}
        noOfLines={expanded ? undefined : 4}
        mb="12px"
        lineHeight="1.5"
        whiteSpace="pre-wrap"
      >
        {bookmark.text}
      </Text>

      <Flex justify="space-between" align="center">
        <HStack spacing="12px">
          <Flex align="center" gap="4px">
            <MdFavorite size={14} color="#e25555" />
            <Text fontSize="xs" color={subColor}>
              {formatNumber(bookmark.likes)}
            </Text>
          </Flex>
          <Flex align="center" gap="4px">
            <MdRepeat size={14} color="#00ba7c" />
            <Text fontSize="xs" color={subColor}>
              {formatNumber(bookmark.retweets)}
            </Text>
          </Flex>
          <Flex align="center" gap="4px">
            <MdVisibility size={14} color="#8899a6" />
            <Text fontSize="xs" color={subColor}>
              {formatNumber(bookmark.views)}
            </Text>
          </Flex>
        </HStack>

        <HStack spacing="4px">
          {bookmark.tags && bookmark.tags.length > 0 &&
            bookmark.tags.slice(0, 3).map((tag) => (
              <Tag
                key={tag}
                size="sm"
                borderRadius="full"
                variant="subtle"
                colorScheme="brand"
                cursor="pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick && onTagClick(tag);
                }}
              >
                <TagLabel fontSize="xs">{tag}</TagLabel>
              </Tag>
            ))}
          <IconButton
            icon={expanded ? <MdExpandLess /> : <MdExpandMore />}
            size="xs"
            variant="ghost"
            color={subColor}
            aria-label="Expand"
            onClick={toggleExpand}
          />
        </HStack>
      </Flex>

      <Collapse in={expanded} animateOpacity>
        <Box mt="12px" pt="12px" borderTop="1px solid" borderColor={borderColor}>
          {/* Notes */}
          <Text fontSize="xs" fontWeight="700" color={subColor} mb="4px">
            Notes
          </Text>
          <Textarea
            size="sm"
            fontSize="xs"
            value={notes}
            onChange={(e) => { e.stopPropagation(); setNotes(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Add personal notes..."
            borderRadius="12px"
            minH="60px"
            mb="4px"
          />
          {notesChanged && (
            <Button
              size="xs"
              leftIcon={<MdSave />}
              colorScheme="brand"
              variant="solid"
              borderRadius="8px"
              onClick={saveNotes}
              mb="8px"
            >
              Save Notes
            </Button>
          )}

          {/* Scraped content */}
          {hasScraped && (
            <Box mt="8px">
              <Text fontSize="xs" fontWeight="700" color={subColor} mb="4px">
                Scraped Content
              </Text>
              {bookmark.scraped_json.articles?.map((article, i) => (
                <Box key={i} mb="8px" p="8px" bg={codeBg} borderRadius="8px">
                  <Text fontSize="xs" fontWeight="600" color={textColor} mb="2px">
                    {article.title || "Linked Article"}
                  </Text>
                  {article.description && (
                    <Text fontSize="xs" color={subColor} mb="4px">
                      {article.description}
                    </Text>
                  )}
                  <Text fontSize="xs" color={subColor} noOfLines={6} whiteSpace="pre-wrap">
                    {article.markdown || article.text || ""}
                  </Text>
                  {article.url && (
                    <Link
                      href={article.url}
                      isExternal
                      fontSize="xs"
                      color="brand.400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open article
                    </Link>
                  )}
                </Box>
              ))}
              {!bookmark.scraped_json.articles?.length && (
                <Text fontSize="xs" color={subColor}>
                  Scraped data available (no linked articles found)
                </Text>
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Card>
  );
}
