import { getDatabase, ref, push, update, remove, get, query, orderByChild, equalTo } from 'firebase/database';

const db = getDatabase();

class SquadService {
  /**
   * Migrate legacy 'crews' data to 'squads'
   * Forward-compatible: keeps 'crews' intact but copies to 'squads'
   */
  async migrateCrewsToSquads() {
    try {
      const crewsRef = ref(db, 'crews');
      const snapshot = await get(crewsRef);
      if (snapshot.exists()) {
        const crewsData = snapshot.val();
        const squadsRef = ref(db, 'squads');
        
        // Check if migration already happened to avoid overwriting newer data
        const squadsSnap = await get(squadsRef);
        if (!squadsSnap.exists()) {
             await update(squadsRef, crewsData);
             console.log('Migrated crews to squads successfully.');
        }
      }
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Create a new squad
   * @param {string} name 
   * @param {string} tag 
   * @param {boolean} isPrivate 
   * @param {string} creatorId 
   */
  async createSquad(name, tag, isPrivate, creatorId) {
    const squadsRef = ref(db, 'squads');
    const newSquad = {
      name,
      tag,
      isPrivate,
      members: {
        [creatorId]: { role: 'admin', joinedAt: Date.now() }
      },
      createdAt: Date.now(),
      createdBy: creatorId
    };
    return await push(squadsRef, newSquad);
  }

  /**
   * Join a squad
   * @param {string} squadId 
   * @param {string} userId 
   */
  async joinSquad(squadId, userId) {
    const memberRef = ref(db, `squads/${squadId}/members/${userId}`);
    await update(memberRef, {
      role: 'member',
      joinedAt: Date.now()
    });
  }

  /**
   * Leave a squad
   * @param {string} squadId 
   * @param {string} userId 
   */
  async leaveSquad(squadId, userId) {
    const memberRef = ref(db, `squads/${squadId}/members/${userId}`);
    await remove(memberRef);
  }

  /**
   * Update a squad
   * @param {string} squadId 
   * @param {Object} updates 
   */
  async updateSquad(squadId, updates) {
    const squadRef = ref(db, `squads/${squadId}`);
    await update(squadRef, updates);
  }

  /**
   * Delete a squad
   * @param {string} squadId 
   */
  async deleteSquad(squadId) {
    const squadRef = ref(db, `squads/${squadId}`);
    await remove(squadRef);
  }

  /**
   * Create a recruitment post for a team finding
   * @param {Object} postData { title, description, tags, authorId, authorName, eventType }
   */
  async createRecruitPost(postData) {
    const postsRef = ref(db, 'recruit_posts');
    const newPost = {
      ...postData,
      createdAt: Date.now(),
      status: 'open'
    };
    return await push(postsRef, newPost);
  }

  /**
   * Update a recruitment post
   * @param {string} postId 
   * @param {Object} updates 
   */
  async updateRecruitPost(postId, updates) {
    const postRef = ref(db, `recruit_posts/${postId}`);
    await update(postRef, updates);
  }

  /**
   * Delete a recruitment post
   * @param {string} postId 
   */
  async deleteRecruitPost(postId) {
    const postRef = ref(db, `recruit_posts/${postId}`);
    await remove(postRef);
  }

  /**
   * Send an encrypted message to a squad channel
   * @param {string} squadId 
   * @param {string} userId 
   * @param {string} content 
   */
  async sendSquadMessage(squadId, userId, content) {
    const messagesRef = ref(db, `squads/${squadId}/messages`);
    
    // Simple "Encryption" simulation (Base64)
    // In a real app, use a proper crypto library like crypto-js with a shared key
    const encryptedContent = btoa(content);

    const newMessage = {
      senderId: userId,
      content: encryptedContent,
      isEncrypted: true,
      timestamp: Date.now()
    };
    
    return await push(messagesRef, newMessage);
  }
}

export default new SquadService();
