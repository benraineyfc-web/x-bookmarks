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
  Badge,
  List,
  ListItem,
  ListIcon,
  Avatar,
} from "@chakra-ui/react";
import {
  MdOpenInNew,
  MdFavorite,
  MdFavoriteBorder,
  MdRepeat,
  MdVisibility,
  MdExpandMore,
  MdExpandLess,
  MdSave,
  MdDelete,
  MdStar,
  MdStarBorder,
  MdCheckCircle,
} from "react-icons/md";
import Card from "../card/Card";
import { db } from "../../lib/db";
import { getCategoryColor } from "../../lib/categorize";

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
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

export default function BookmarkCard({ bookmark, onSelect, isSelected, onTagClick, onDelete, onFavoriteToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(bookmark.notes || "");
  const [savedNotes, setSavedNotes] = useState(bookmark.notes || "");
  const [isFav, setIsFav] = useState(bookmark.favorite || false);

  const textColor = useColorModeValue("gray.800", "white");
  const subColor = useColorModeValue("gray.500", "gray.400");
  const borderColor = useColorModeValue("gray.100", "whiteAlpha.100");
  const selectedBorder = useColorModeValue("brand.500", "brand.400");
  const codeBg = useColorModeValue("gray.50", "navy.900");
  const actionBg = useColorModeValue("green.50", "green.900");
  const cardHoverBg = useColorModeValue("gray.50", "navy.700");
  const metaBg = useColorModeValue("gray.50", "whiteAlpha.50");

  const hasScraped = bookmark.scraped_json && Object.keys(bookmark.scraped_json).length > 0;
  const notesChanged = notes !== savedNotes;
  const hasActions = bookmark.actionItems && bookmark.actionItems.length > 0;

  const saveNotes = async (e) => {
    e.stopPropagation();
    await db.bookmarks.update(bookmark.id, { notes });
    setSavedNotes(notes);
  };

  const toggleExpand = (e) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    await db.bookmarks.delete(bookmark.id);
    if (onDelete) onDelete(bookmark.id);
  };

  const handleFavorite = async (e) => {
    e.stopPropagation();
    const newVal = !isFav;
    setIsFav(newVal);
    await db.bookmarks.update(bookmark.id, { favorite: newVal });
    if (onFavoriteToggle) onFavoriteToggle(bookmark.id, newVal);
  };

  return (
    <Card
      border="1.5px solid"
      borderColor={isSelected ? selectedBorder : "transparent"}
      cursor="pointer"
      onClick={() => onSelect && onSelect(bookmark)}
      _hover={{
        borderColor: isSelected ? selectedBorder : borderColor,
        transform: "translateY(-2px)",
        boxShadow: "0px 8px 20px rgba(0, 0, 0, 0.06)",
      }}
      transition="all 0.2s ease"
      position="relative"
      p="16px"
    >
      {/* Author row */}
      <Flex align="center" gap="10px" mb="10px">
        <Avatar
          size="sm"
          name={bookmark.author_name || bookmark.author_username}
          bg="brand.500"
          color="white"
          fontSize="xs"
        />
        <Box flex="1" minW="0">
          <Text fontSize="sm" fontWeight="700" color={textColor} noOfLines={1}>
            {bookmark.author_name || bookmark.author_username}
          </Text>
          <Text fontSize="xs" color={subColor}>
            @{bookmark.author_username}
          </Text>
        </Box>
        <Flex gap="1px" align="center" flexShrink={0}>
          <Tooltip label={isFav ? "Unfavorite" : "Favorite"}>
            <IconButton
              icon={isFav ? <MdStar /> : <MdStarBorder />}
              size="xs"
              variant="ghost"
              color={isFav ? "orange.400" : subColor}
              aria-label="Favorite"
              onClick={handleFavorite}
            />
          </Tooltip>
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
          <Tooltip label="Delete">
            <IconButton
              icon={<MdDelete />}
              size="xs"
              variant="ghost"
              color={subColor}
              aria-label="Delete"
              onClick={handleDelete}
              _hover={{ bg: "red.50", color: "red.500" }}
            />
          </Tooltip>
        </Flex>
      </Flex>

      {/* Tweet text */}
      <Text
        fontSize="sm"
        color={textColor}
        noOfLines={expanded ? undefined : 5}
        mb="12px"
        lineHeight="1.6"
        whiteSpace="pre-wrap"
      >
        {bookmark.text}
      </Text>

      {/* Categories */}
      {bookmark.categories && bookmark.categories.length > 0 && (
        <HStack spacing="6px" mb="10px" flexWrap="wrap">
          {bookmark.categories.map((cat) => (
            <Badge
              key={cat}
              colorScheme={getCategoryColor(cat)}
              fontSize="10px"
              borderRadius="full"
              px="8px"
              py="2px"
              fontWeight="500"
              variant="subtle"
            >
              {cat}
            </Badge>
          ))}
        </HStack>
      )}

      {/* Bottom meta row - source, stats, date */}
      <Flex
        align="center"
        justify="space-between"
        pt="10px"
        borderTop="1px solid"
        borderColor={borderColor}
      >
        <HStack spacing="10px">
          <Flex align="center" gap="3px">
            <MdFavorite size={13} color="#e25555" />
            <Text fontSize="xs" color={subColor} fontWeight="500">
              {formatNumber(bookmark.likes)}
            </Text>
          </Flex>
          <Flex align="center" gap="3px">
            <MdRepeat size={13} color="#00ba7c" />
            <Text fontSize="xs" color={subColor} fontWeight="500">
              {formatNumber(bookmark.retweets)}
            </Text>
          </Flex>
          <Flex align="center" gap="3px">
            <MdVisibility size={13} color="#8899a6" />
            <Text fontSize="xs" color={subColor} fontWeight="500">
              {formatNumber(bookmark.views)}
            </Text>
          </Flex>
        </HStack>

        <HStack spacing="8px" align="center">
          <HStack spacing="4px">
            <Text fontSize="10px" fontWeight="600" color={subColor}>X</Text>
            <Text fontSize="10px" color={subColor}>x.com</Text>
          </HStack>
          <Text fontSize="10px" color={subColor}>{formatDate(bookmark.created_at)}</Text>
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

      {/* Tags */}
      {bookmark.tags && bookmark.tags.length > 0 && (
        <HStack spacing="4px" mt="8px" flexWrap="wrap">
          {bookmark.tags.slice(0, 4).map((tag) => (
            <Tag
              key={tag}
              size="sm"
              borderRadius="full"
              variant="subtle"
              colorScheme="gray"
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick && onTagClick(tag);
              }}
            >
              <TagLabel fontSize="xs">#{tag}</TagLabel>
            </Tag>
          ))}
        </HStack>
      )}

      {/* Expandable section */}
      <Collapse in={expanded} animateOpacity>
        <Box mt="12px" pt="12px" borderTop="1px solid" borderColor={borderColor}>
          {/* Action Items */}
          {hasActions && (
            <Box mb="12px">
              <Text fontSize="xs" fontWeight="700" color="green.500" mb="6px">
                Actionable Steps
              </Text>
              <Box bg={actionBg} borderRadius="10px" p="10px">
                <List spacing="4px">
                  {bookmark.actionItems.map((item, i) => (
                    <ListItem key={i} fontSize="xs" color={textColor} display="flex" alignItems="flex-start">
                      <ListIcon as={MdCheckCircle} color="green.400" mt="2px" />
                      <Text>{item}</Text>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Box>
          )}

          {/* Notes */}
          <Text fontSize="xs" fontWeight="600" color={subColor} mb="4px">
            Notes
          </Text>
          <Textarea
            size="sm"
            fontSize="xs"
            value={notes}
            onChange={(e) => { e.stopPropagation(); setNotes(e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Add personal notes..."
            borderRadius="10px"
            minH="60px"
            mb="4px"
            bg={codeBg}
            border="none"
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
              <Text fontSize="xs" fontWeight="600" color={subColor} mb="4px">
                Scraped Content
              </Text>
              {bookmark.scraped_json.articles?.map((article, i) => (
                <Box key={i} mb="8px" p="10px" bg={codeBg} borderRadius="10px">
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
