import axios from "axios";

export const fetchJiraTicket = async (ticketId) => {

  try {

    const response = await axios.get(
      `https://${process.env.JIRA_DOMAIN}.atlassian.net/rest/api/3/issue/${ticketId}`,
      {
        auth: {
          username: process.env.JIRA_EMAIL,
          password: process.env.JIRA_API_TOKEN
        }
      }
    );

    return {
      status: response.data.fields.status.name,
      assignee: response.data.fields.assignee?.displayName
    };

  } catch(error) {
    console.log(error.message);
    return null;
  }
};