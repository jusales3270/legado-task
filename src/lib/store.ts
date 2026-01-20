export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  size: number;
  uploadedAt: string;
  thumbnailUrl?: string;
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  createdAt: string;
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  listId: string;
  tags: Tag[];
  members: Member[];
  dueDate?: string;
  coverImage?: string;
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
  comments?: Comment[];
  archived?: boolean;
  order: number;
}

export interface List {
  id: string;
  title: string;
  boardId: string;
  cards: Card[];
  order: number;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  color: string;
  isFavorite: boolean;
  lists: List[];
  members: Member[];
  updatedAt: string;
}

// Store state
class Store {
  private boards: Board[];
  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("kanban_boards");
      if (stored) {
        try {
          this.boards = JSON.parse(stored) as Board[];
        } catch {
          this.boards = [];
        }
      } else {
        this.boards = [];
      }
    } else {
      this.boards = [];
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kanban_boards", JSON.stringify(this.boards));
    }
    this.listeners.forEach((listener) => listener());
  }

  getBoards(): Board[] {
    return this.boards;
  }

  getBoard(id: string): Board | undefined {
    return this.boards.find((b) => b.id === id);
  }

  getFavoriteBoards(): Board[] {
    return this.boards.filter((b) => b.isFavorite);
  }

  getRecentBoards(): Board[] {
    return this.boards.slice();
  }

  addBoard(board: Omit<Board, "id" | "updatedAt">) {
    const id = Date.now().toString();
    const lists = board.lists.length > 0
      ? board.lists
      : [
        {
          id: `l${Date.now()}`,
          title: "A fazer",
          boardId: id,
          cards: [],
          order: 0,
        },
      ];

    const newBoard: Board = {
      ...board,
      id,
      updatedAt: "agora mesmo",
      lists,
    };
    this.boards.push(newBoard);
    this.notify();
    return newBoard;
  }

  updateBoard(id: string, updates: Partial<Board>) {
    const index = this.boards.findIndex((b) => b.id === id);
    if (index !== -1) {
      this.boards[index] = { ...this.boards[index], ...updates, updatedAt: "agora mesmo" };
      this.notify();
    }
  }

  toggleFavorite(id: string) {
    const board = this.boards.find((b) => b.id === id);
    if (board) {
      board.isFavorite = !board.isFavorite;
      this.notify();
    }
  }

  deleteBoard(id: string) {
    this.boards = this.boards.filter((b) => b.id !== id);
    this.notify();
  }

  addMemberToBoard(boardId: string, member: Omit<Member, "id">) {
    const board = this.boards.find((b) => b.id === boardId);
    if (!board) return;

    const newMember: Member = {
      ...member,
      id: `m${Date.now()}`,
    };

    if (!board.members.some((m) => m.email === newMember.email)) {
      board.members.push(newMember);
      this.notify();
    }

    return newMember;
  }

  removeMemberFromBoard(boardId: string, memberId: string) {
    const board = this.boards.find((b) => b.id === boardId);
    if (!board) return;
    board.members = board.members.filter((m) => m.id !== memberId);
    this.notify();
  }

  addList(boardId: string, title: string) {
    const board = this.boards.find((b) => b.id === boardId);
    if (board) {
      const newList: List = {
        id: `l${Date.now()}`,
        title,
        boardId,
        cards: [],
        order: board.lists.length,
      };
      board.lists.push(newList);
      this.notify();
      return newList;
    }
  }

  renameList(listId: string, newTitle: string) {
    for (const board of this.boards) {
      const list = board.lists.find((l) => l.id === listId);
      if (list) {
        list.title = newTitle;
        this.notify();
        return;
      }
    }
  }

  deleteList(listId: string) {
    for (const board of this.boards) {
      const originalLength = board.lists.length;
      board.lists = board.lists.filter((l) => l.id !== listId);
      if (board.lists.length !== originalLength) {
        this.notify();
        return;
      }
    }
  }

  addCard(listId: string, title: string) {
    for (const board of this.boards) {
      const list = board.lists.find((l) => l.id === listId);
      if (list) {
        const newCard: Card = {
          id: `c${Date.now()}`,
          title,
          listId,
          tags: [],
          members: [],
          checklist: [],
          attachments: [],
          comments: [],
          archived: false,
          order: list.cards.length,
        };
        list.cards.push(newCard);
        this.notify();
        return newCard;
      }
    }
  }

  duplicateCard(cardId: string) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const cardIndex = list.cards.findIndex((c) => c.id === cardId);
        if (cardIndex !== -1) {
          const originalCard = list.cards[cardIndex];
          const duplicatedCard: Card = {
            ...originalCard,
            id: `c${Date.now()}`,
            title: `${originalCard.title} (cópia)`,
            order: list.cards.length,
          };
          list.cards.push(duplicatedCard);
          this.notify();
          return duplicatedCard;
        }
      }
    }
  }

  moveCard(cardId: string, newListId: string) {
    for (const board of this.boards) {
      let sourceList: List | undefined;
      let cardToMove: Card | undefined;
      let cardIndex = -1;

      for (const list of board.lists) {
        cardIndex = list.cards.findIndex((c) => c.id === cardId);
        if (cardIndex !== -1) {
          sourceList = list;
          cardToMove = list.cards[cardIndex];
          break;
        }
      }

      if (sourceList && cardToMove) {
        if (sourceList.id !== newListId) {
          sourceList.cards.splice(cardIndex, 1);
          const targetList = board.lists.find((l) => l.id === newListId);
          if (targetList) {
            cardToMove.listId = newListId;
            targetList.cards.push(cardToMove);
          }
        }

        // Reordenar índices de ordem nas listas afetadas
        sourceList.cards.forEach((card, index) => {
          card.order = index;
        });
        const targetList = board.lists.find((l) => l.id === newListId);
        if (targetList) {
          targetList.cards.forEach((card, index) => {
            card.order = index;
          });
        }

        this.notify();
        return;
      }
    }
  }

  moveCardTo(cardId: string, targetListId: string, targetCardId?: string) {
    for (const board of this.boards) {
      let sourceList: List | undefined;
      let targetList: List | undefined;
      let cardToMove: Card | undefined;
      let sourceIndex = -1;

      for (const list of board.lists) {
        const index = list.cards.findIndex((c) => c.id === cardId);
        if (index !== -1) {
          sourceList = list;
          sourceIndex = index;
          cardToMove = list.cards[index];
        }
        if (list.id === targetListId) {
          targetList = list;
        }
      }

      if (!sourceList || !targetList || !cardToMove) continue;

      // Remover do array de origem
      sourceList.cards.splice(sourceIndex, 1);

      // Atualizar listId do card
      cardToMove.listId = targetListId;

      if (!targetCardId) {
        // Se não tiver card de referência, adiciona ao final da lista alvo
        targetList.cards.push(cardToMove);
      } else {
        const targetIndex = targetList.cards.findIndex((c) => c.id === targetCardId);
        if (targetIndex === -1) {
          targetList.cards.push(cardToMove);
        } else {
          targetList.cards.splice(targetIndex, 0, cardToMove);
        }
      }

      // Reordenar índices de ordem nas duas listas
      sourceList.cards.forEach((card, index) => {
        card.order = index;
      });
      targetList.cards.forEach((card, index) => {
        card.order = index;
      });

      this.notify();
      return;
    }
  }

  moveList(boardId: string, activeListId: string, overListId: string) {
    const boardIndex = this.boards.findIndex((b) => b.id === boardId);
    if (boardIndex === -1 || activeListId === overListId) return;

    const board = this.boards[boardIndex];
    const oldIndex = board.lists.findIndex((l) => l.id === activeListId);
    const newIndex = board.lists.findIndex((l) => l.id === overListId);
    if (oldIndex === -1 || newIndex === -1) return;

    // Create a new array with reordered lists
    const newLists = [...board.lists];
    const [moved] = newLists.splice(oldIndex, 1);
    newLists.splice(newIndex, 0, moved);

    // Update order for each list
    newLists.forEach((list, index) => {
      list.order = index;
    });

    // Create a new board object reference for React to detect the change
    this.boards[boardIndex] = {
      ...board,
      lists: newLists,
      updatedAt: "agora mesmo",
    };

    this.notify();
  }

  updateCard(cardId: string, updates: Partial<Card>) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const cardIndex = list.cards.findIndex((c) => c.id === cardId);
        if (cardIndex !== -1) {
          list.cards[cardIndex] = { ...list.cards[cardIndex], ...updates };
          this.notify();
          return;
        }
      }
    }
  }

  deleteCard(cardId: string) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        list.cards = list.cards.filter((c) => c.id !== cardId);
      }
    }
    this.notify();
  }

  getCard(cardId: string): { card: Card; listTitle: string } | undefined {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          return { card, listTitle: list.title };
        }
      }
    }
  }

  toggleArchiveCard(cardId: string) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          card.archived = !card.archived;
          this.notify();
          return;
        }
      }
    }
  }

  addMemberToCard(cardId: string, member: Member) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          if (!card.members.some((m) => m.id === member.id)) {
            card.members.push(member);
            this.notify();
          }
          return;
        }
      }
    }
  }

  removeMemberFromCard(cardId: string, memberId: string) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          card.members = card.members.filter((m) => m.id !== memberId);
          this.notify();
          return;
        }
      }
    }
  }

  addTagToCard(cardId: string, tag: Tag) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          if (!card.tags.some((t) => t.id === tag.id)) {
            card.tags.push(tag);
            this.notify();
          }
          return;
        }
      }
    }
  }

  removeTagFromCard(cardId: string, tagId: string) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          card.tags = card.tags.filter((t) => t.id !== tagId);
          this.notify();
          return;
        }
      }
    }
  }

  addAttachmentToCard(cardId: string, attachment: Attachment) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          if (!card.attachments) card.attachments = [];
          card.attachments.push(attachment);
          this.notify();
          return;
        }
      }
    }
  }

  removeAttachmentFromCard(cardId: string, attachmentId: string) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card && card.attachments) {
          card.attachments = card.attachments.filter((a) => a.id !== attachmentId);
          this.notify();
          return;
        }
      }
    }
  }

  addCommentToCard(cardId: string, comment: Comment) {
    for (const board of this.boards) {
      for (const list of board.lists) {
        const card = list.cards.find((c) => c.id === cardId);
        if (card) {
          if (!card.comments) card.comments = [];
          card.comments.push(comment);
          this.notify();
          return;
        }
      }
    }
  }
}

export const store = new Store();
